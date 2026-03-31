import sharp from "sharp";
import path from "path";
import fs from "fs";

// Resolve mobile/ root using ESM-compatible import.meta
const MOBILE_ROOT = path.resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// Pixel art letter definitions (matches packages/web/app/components/brand/logo.tsx)
// ---------------------------------------------------------------------------

// B letter - 7 wide x 9 tall pixels
const B_PIXELS = [
  [1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 0],
];

// S letter - 7 wide x 9 tall pixels
const S_PIXELS = [
  [0, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1, 1],
  [0, 0, 0, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 0],
];

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const LOGO_GREEN = "#5DBE94";
const LOGO_ROSE = "#C75B64";
const BACKGROUND = "#0A0A0A";

// ---------------------------------------------------------------------------
// SVG layout constants (from the original 48x48 viewBox)
// ---------------------------------------------------------------------------

const VIEWBOX_SIZE = 48;
const PIXEL_SIZE = 3;
const SHADOW_OFFSET = 2;
const B_START_X = 3;
const B_START_Y = 6;
const S_START_X = 24;
const S_START_Y = 6;

// ---------------------------------------------------------------------------
// SVG builder helpers
// ---------------------------------------------------------------------------

function buildPixelRects(
  pixels: number[][],
  startX: number,
  startY: number,
  pixelSize: number,
  fill: string,
): string {
  const rects: string[] = [];
  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      if (pixels[y][x]) {
        rects.push(
          `<rect x="${startX + x * pixelSize}" y="${startY + y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${fill}"/>`,
        );
      }
    }
  }
  return rects.join("\n");
}

/**
 * Build an SVG string containing the BS logo.
 *
 * @param width      Output SVG width in px
 * @param height     Output SVG height in px
 * @param logoScale  How much to scale the 48x48 logo (e.g. 13.75 gives ~660px)
 * @param options.background  Fill colour for background rect (set to "none" or "transparent" to skip)
 */
function buildLogoSvg(
  width: number,
  height: number,
  logoScale: number,
  options: { background?: string } = {},
): string {
  const bg = options.background ?? BACKGROUND;

  // Scaled pixel size
  const ps = PIXEL_SIZE * logoScale;
  const so = SHADOW_OFFSET * logoScale;

  // Offset to centre the 48-unit logo (scaled) in the canvas
  const logoWidth = VIEWBOX_SIZE * logoScale;
  const logoHeight = VIEWBOX_SIZE * logoScale;
  const offsetX = (width - logoWidth) / 2;
  const offsetY = (height - logoHeight) / 2;

  // Helper that offsets original viewBox coords into the final canvas
  const bx = (v: number) => offsetX + v * logoScale;
  const by = (v: number) => offsetY + v * logoScale;

  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);

  // Background
  if (bg !== "none" && bg !== "transparent") {
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>`);
  }

  // Rose shadow layers (drawn first, offset by shadowOffset)
  parts.push(
    buildPixelRects(B_PIXELS, bx(B_START_X) + so, by(B_START_Y) + so, ps, LOGO_ROSE),
  );
  parts.push(
    buildPixelRects(S_PIXELS, bx(S_START_X) + so, by(S_START_Y) + so, ps, LOGO_ROSE),
  );

  // Green letters on top
  parts.push(
    buildPixelRects(B_PIXELS, bx(B_START_X), by(B_START_Y), ps, LOGO_GREEN),
  );
  parts.push(
    buildPixelRects(S_PIXELS, bx(S_START_X), by(S_START_Y), ps, LOGO_GREEN),
  );

  parts.push("</svg>");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Asset generation helpers
// ---------------------------------------------------------------------------

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function writePng(
  svgString: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  ensureDir(outputPath);
  await sharp(Buffer.from(svgString))
    .resize(width, height)
    .png()
    .toFile(outputPath);
  console.log(`  -> ${path.relative(MOBILE_ROOT, outputPath)} (${width}x${height})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Generating Boardsesh app assets...\n");
  console.log(`Output root: ${MOBILE_ROOT}\n`);

  // -----------------------------------------------------------------------
  // 1. iOS App Icon (1024x1024)
  // -----------------------------------------------------------------------
  console.log("[iOS] App Icon (1024x1024)");
  {
    const size = 1024;
    // ~65% of canvas -> logoScale so that 48 * scale ~ 660
    const logoScale = (size * 0.65) / VIEWBOX_SIZE;
    const svg = buildLogoSvg(size, size, logoScale);
    const outPath = path.join(
      MOBILE_ROOT,
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    );
    await writePng(svg, outPath, size, size);
  }

  // -----------------------------------------------------------------------
  // 2. iOS Splash Screen (2732x2732) - three copies for the image set
  // -----------------------------------------------------------------------
  console.log("\n[iOS] Splash Screen (2732x2732)");
  {
    const size = 2732;
    // ~18% of canvas -> logoScale so that 48 * scale ~ 480
    const logoScale = (size * 0.18) / VIEWBOX_SIZE;
    const svg = buildLogoSvg(size, size, logoScale);
    const splashNames = [
      "splash-2732x2732.png",
      "splash-2732x2732-1.png",
      "splash-2732x2732-2.png",
    ];
    // Generate the PNG once, then copy for the other two
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();

    for (const name of splashNames) {
      const outPath = path.join(
        MOBILE_ROOT,
        `ios/App/App/Assets.xcassets/Splash.imageset/${name}`,
      );
      ensureDir(outPath);
      fs.writeFileSync(outPath, pngBuffer);
      console.log(`  -> ${path.relative(MOBILE_ROOT, outPath)} (${size}x${size})`);
    }
  }

  // -----------------------------------------------------------------------
  // 3. Android icons at all density buckets
  // -----------------------------------------------------------------------
  console.log("\n[Android] Launcher icons");
  const androidDensities: Array<{ name: string; size: number }> = [
    { name: "mdpi", size: 48 },
    { name: "hdpi", size: 72 },
    { name: "xhdpi", size: 96 },
    { name: "xxhdpi", size: 144 },
    { name: "xxxhdpi", size: 192 },
  ];

  for (const { name, size } of androidDensities) {
    const resDir = path.join(
      MOBILE_ROOT,
      `android/app/src/main/res/mipmap-${name}`,
    );

    // ic_launcher.png and ic_launcher_round.png - full icon with background
    const logoScale = (size * 0.65) / VIEWBOX_SIZE;
    const svg = buildLogoSvg(size, size, logoScale);
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();

    for (const iconName of ["ic_launcher.png", "ic_launcher_round.png"]) {
      const outPath = path.join(resDir, iconName);
      ensureDir(outPath);
      fs.writeFileSync(outPath, pngBuffer);
      console.log(`  -> ${path.relative(MOBILE_ROOT, outPath)} (${size}x${size})`);
    }

    // ic_launcher_foreground.png - logo on transparent background (for adaptive icons)
    const fgSvg = buildLogoSvg(size, size, logoScale, { background: "none" });
    const fgPath = path.join(resDir, "ic_launcher_foreground.png");
    ensureDir(fgPath);
    await sharp(Buffer.from(fgSvg))
      .resize(size, size)
      .png()
      .toFile(fgPath);
    console.log(`  -> ${path.relative(MOBILE_ROOT, fgPath)} (${size}x${size})`);
  }

  console.log("\nAll assets generated successfully.");
}

main().catch((err) => {
  console.error("Asset generation failed:", err);
  process.exit(1);
});
