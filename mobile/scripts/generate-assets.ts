import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const MOBILE_ROOT = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(MOBILE_ROOT, '..');
const SVG_ROOT = path.join(REPO_ROOT, 'svg');

const CORAL = '#d65a4f';

const APP_ICON_SVG = path.join(SVG_ROOT, 'app-icon/icon-coral-1024.svg');
const SPLASH_LOGO_SVG = path.join(SVG_ROOT, 'mark/route-mark-on-coral.svg');
const ADAPTIVE_FG_SVG = path.join(SVG_ROOT, 'mark/route-mark.svg');

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadSvg(svgPath: string): Buffer {
  return fs.readFileSync(svgPath);
}

async function renderSquareSvg(svgBuffer: Buffer, size: number, outputPath: string): Promise<void> {
  ensureDir(outputPath);
  await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
  console.info(`  -> ${path.relative(MOBILE_ROOT, outputPath)} (${size}x${size})`);
}

/**
 * Render a splash PNG: coral background with the route-mark logo centred.
 * Logo occupies ~`logoFraction` of the shorter canvas dimension.
 */
async function renderSplash(
  width: number,
  height: number,
  outputPath: string,
  logoSvg: Buffer,
  logoFraction = 0.4,
): Promise<Buffer> {
  const logoSize = Math.round(Math.min(width, height) * logoFraction);
  const logoPng = await sharp(logoSvg).resize(logoSize, logoSize).png().toBuffer();

  const composed = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: CORAL,
    },
  })
    .composite([{ input: logoPng, gravity: 'centre' }])
    .png()
    .toBuffer();

  ensureDir(outputPath);
  fs.writeFileSync(outputPath, composed);
  console.info(`  -> ${path.relative(MOBILE_ROOT, outputPath)} (${width}x${height})`);
  return composed;
}

/**
 * Render the Android adaptive-icon foreground: transparent canvas with the mark
 * sized to the 72dp safe zone (~67% of the 108dp canvas) so it survives the
 * system mask/crop without clipping.
 */
async function renderAdaptiveForeground(size: number, outputPath: string, logoSvg: Buffer): Promise<void> {
  const safeZone = Math.round((size * 72) / 108);
  const logoPng = await sharp(logoSvg).resize(safeZone, safeZone).png().toBuffer();

  const composed = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logoPng, gravity: 'centre' }])
    .png()
    .toBuffer();

  ensureDir(outputPath);
  fs.writeFileSync(outputPath, composed);
  console.info(`  -> ${path.relative(MOBILE_ROOT, outputPath)} (${size}x${size})`);
}

async function main() {
  console.info('Generating Boardsesh app assets...\n');
  console.info(`Output root: ${MOBILE_ROOT}`);
  console.info(`SVG source:  ${SVG_ROOT}\n`);

  const appIconSvg = loadSvg(APP_ICON_SVG);
  const splashLogoSvg = loadSvg(SPLASH_LOGO_SVG);
  const adaptiveFgSvg = loadSvg(ADAPTIVE_FG_SVG);

  // ---------------------------------------------------------------------------
  // 1. iOS App Icon (1024x1024)
  // ---------------------------------------------------------------------------
  console.info('[iOS] App Icon (1024x1024)');
  await renderSquareSvg(
    appIconSvg,
    1024,
    path.join(MOBILE_ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'),
  );

  // ---------------------------------------------------------------------------
  // 2. iOS Splash (2732x2732, 3 copies for the imageset)
  // ---------------------------------------------------------------------------
  console.info('\n[iOS] Splash Screen (2732x2732)');
  {
    const size = 2732;
    const splashNames = ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'];
    const firstPath = path.join(MOBILE_ROOT, `ios/App/App/Assets.xcassets/Splash.imageset/${splashNames[0]}`);
    const buffer = await renderSplash(size, size, firstPath, splashLogoSvg, 0.4);
    for (const name of splashNames.slice(1)) {
      const outPath = path.join(MOBILE_ROOT, `ios/App/App/Assets.xcassets/Splash.imageset/${name}`);
      ensureDir(outPath);
      fs.writeFileSync(outPath, buffer);
      console.info(`  -> ${path.relative(MOBILE_ROOT, outPath)} (${size}x${size})`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Android launcher icons (legacy + adaptive foreground) at all densities
  // ---------------------------------------------------------------------------
  console.info('\n[Android] Launcher icons');
  const androidIconDensities: Array<{ name: string; size: number }> = [
    { name: 'mdpi', size: 48 },
    { name: 'hdpi', size: 72 },
    { name: 'xhdpi', size: 96 },
    { name: 'xxhdpi', size: 144 },
    { name: 'xxxhdpi', size: 192 },
  ];

  for (const { name, size } of androidIconDensities) {
    const resDir = path.join(MOBILE_ROOT, `android/app/src/main/res/mipmap-${name}`);

    // Legacy icons (square + round) — full coral icon, system does not mask these
    const legacyPng = await sharp(appIconSvg).resize(size, size).png().toBuffer();
    for (const iconName of ['ic_launcher.png', 'ic_launcher_round.png']) {
      const outPath = path.join(resDir, iconName);
      ensureDir(outPath);
      fs.writeFileSync(outPath, legacyPng);
      console.info(`  -> ${path.relative(MOBILE_ROOT, outPath)} (${size}x${size})`);
    }

    // Adaptive icon foreground — transparent, mark inside the safe zone
    await renderAdaptiveForeground(size, path.join(resDir, 'ic_launcher_foreground.png'), adaptiveFgSvg);
  }

  // ---------------------------------------------------------------------------
  // 4. Android splash screens — default + port/land density buckets
  // ---------------------------------------------------------------------------
  console.info('\n[Android] Splash screens');
  // Default (used as fallback / themed window background) keeps the historical
  // 480x320 size to match the existing drawable.
  await renderSplash(
    480,
    320,
    path.join(MOBILE_ROOT, 'android/app/src/main/res/drawable/splash.png'),
    splashLogoSvg,
    0.5,
  );

  const splashDensities: Array<{ name: string; portrait: [number, number] }> = [
    { name: 'mdpi', portrait: [320, 480] },
    { name: 'hdpi', portrait: [480, 800] },
    { name: 'xhdpi', portrait: [720, 1280] },
    { name: 'xxhdpi', portrait: [960, 1600] },
    { name: 'xxxhdpi', portrait: [1280, 1920] },
  ];

  for (const { name, portrait } of splashDensities) {
    const [pw, ph] = portrait;
    await renderSplash(
      pw,
      ph,
      path.join(MOBILE_ROOT, `android/app/src/main/res/drawable-port-${name}/splash.png`),
      splashLogoSvg,
      0.5,
    );
    await renderSplash(
      ph,
      pw,
      path.join(MOBILE_ROOT, `android/app/src/main/res/drawable-land-${name}/splash.png`),
      splashLogoSvg,
      0.5,
    );
  }

  console.info('\nAll assets generated successfully.');
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
