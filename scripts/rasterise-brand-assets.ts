#!/usr/bin/env bun
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DESIGN = join(ROOT, 'design');
const ICON_SVG = join(DESIGN, 'svg', 'icon-master.svg');
// iOS applies its own squircle mask, so the source for Apple icons must be
// flat (no corner radius) to avoid double-rounding.
const ICON_IOS_SVG = join(DESIGN, 'svg', 'icon-master-ios.svg');
const ICON_TRANSPARENT_SVG = join(DESIGN, 'svg', 'icon-master-transparent.svg');
const OG_SVG = join(DESIGN, 'svg', 'og-image.svg');

const SPLASH_BG = '#0e0e10'; // brand surface bg per designer brief §4a

type RasterJob = { svg: string; out: string; width: number; height: number };

const WEB_SIZES = [16, 32, 48, 64, 96, 128, 192, 256, 512];
const IOS_SIZES = [40, 60, 76, 80, 120, 152, 167, 180, 1024];
const ANDROID_SIZES = [48, 72, 96, 144, 192, 512];
const ICO_SIZES = [16, 32, 48];

const ICO_OUT = join(DESIGN, 'web', 'favicon.ico');

const designJobs: RasterJob[] = [
  ...WEB_SIZES.map((s) => ({
    svg: ICON_SVG,
    out: join(DESIGN, 'web', `favicon-${s}.png`),
    width: s,
    height: s,
  })),
  ...IOS_SIZES.map((s) => ({
    svg: ICON_IOS_SVG,
    out: join(DESIGN, 'ios', `apple-icon-${s}.png`),
    width: s,
    height: s,
  })),
  ...ANDROID_SIZES.map((s) => ({
    svg: ICON_SVG,
    out: join(DESIGN, 'android', `ic_launcher-${s}.png`),
    width: s,
    height: s,
  })),
  { svg: OG_SVG, out: join(DESIGN, 'social', 'og-image.png'), width: 1200, height: 630 },
];

async function rasterise(job: RasterJob): Promise<void> {
  const svg = await readFile(job.svg);
  await mkdir(dirname(job.out), { recursive: true });
  const png = await sharp(svg, { density: 384 })
    .resize(job.width, job.height, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(job.out, png);
  console.log(`  ${rel(job.out)}  (${job.width}×${job.height})`);
}

async function pngBuffer(svgPath: string, size: number): Promise<Buffer> {
  const svg = await readFile(svgPath);
  return sharp(svg, { density: 384 }).resize(size, size, { fit: 'fill' }).png({ compressionLevel: 9 }).toBuffer();
}

async function buildIco(svgPath: string, sizes: number[], out: string): Promise<void> {
  const pngs = await Promise.all(sizes.map((s) => pngBuffer(svgPath, s)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const entries = Buffer.alloc(16 * sizes.length);
  let offset = header.length + entries.length;
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]!;
    const png = pngs[i]!;
    const e = i * 16;
    entries.writeUInt8(size === 256 ? 0 : size, e + 0);
    entries.writeUInt8(size === 256 ? 0 : size, e + 1);
    entries.writeUInt8(0, e + 2);
    entries.writeUInt8(0, e + 3);
    entries.writeUInt16LE(1, e + 4);
    entries.writeUInt16LE(32, e + 6);
    entries.writeUInt32LE(png.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += png.length;
  }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.concat([header, entries, ...pngs]));
  console.log(`  ${rel(out)}  (${sizes.join(', ')} px)`);
}

async function copy(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  console.log(`  ${rel(src)} → ${rel(dest)}`);
}

async function renderSplash(width: number, height: number, out: string, logoFraction = 0.4): Promise<void> {
  const svg = await readFile(ICON_TRANSPARENT_SVG);
  const logoSize = Math.round(Math.min(width, height) * logoFraction);
  const logo = await sharp(svg, { density: 384 }).resize(logoSize, logoSize).png().toBuffer();
  const composed = await sharp({ create: { width, height, channels: 4, background: SPLASH_BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, composed);
  console.log(`  ${rel(out)}  (${width}×${height})`);
}

const rel = (p: string) => p.replace(ROOT + '/', '');

async function deployWeb(): Promise<void> {
  const web = join(ROOT, 'packages', 'web');
  await copy(ICON_SVG, join(web, 'app', 'icon.svg'));
  await copy(ICON_TRANSPARENT_SVG, join(web, 'public', 'brand', 'icon-transparent.svg'));
  await copy(ICO_OUT, join(web, 'app', 'favicon.ico'));
  await copy(join(DESIGN, 'web', 'favicon-192.png'), join(web, 'public', 'icons', 'icon-192.png'));
  await copy(join(DESIGN, 'web', 'favicon-512.png'), join(web, 'public', 'icons', 'icon-512.png'));
  await copy(join(DESIGN, 'web', 'favicon-512.png'), join(web, 'public', 'icons', 'icon-maskable-512.png'));
  await copy(join(DESIGN, 'ios', 'apple-icon-180.png'), join(web, 'public', 'icons', 'apple-touch-icon.png'));
}

async function deployMobile(): Promise<void> {
  const mobile = join(ROOT, 'mobile');

  await copy(
    join(DESIGN, 'ios', 'apple-icon-1024.png'),
    join(mobile, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png'),
  );

  const androidDensities: Array<{ dir: string; size: number }> = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];
  for (const { dir, size } of androidDensities) {
    const src = join(DESIGN, 'android', `ic_launcher-${size}.png`);
    const target = join(mobile, 'android', 'app', 'src', 'main', 'res', dir);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      await copy(src, join(target, name));
    }
  }
}

async function renderSplashScreens(): Promise<void> {
  const mobile = join(ROOT, 'mobile');

  // iOS imageset (single 2732 PNG ships under three filenames)
  const iosSplashOut = join(mobile, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset', 'splash-2732x2732.png');
  await renderSplash(2732, 2732, iosSplashOut, 0.4);
  for (const name of ['splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await copy(iosSplashOut, dirname(iosSplashOut) + '/' + name);
  }

  // Android default + per-density (port/land)
  await renderSplash(480, 320, join(mobile, 'android/app/src/main/res/drawable/splash.png'), 0.5);

  const splashDensities: Array<{ name: string; portrait: [number, number] }> = [
    { name: 'mdpi', portrait: [320, 480] },
    { name: 'hdpi', portrait: [480, 800] },
    { name: 'xhdpi', portrait: [720, 1280] },
    { name: 'xxhdpi', portrait: [960, 1600] },
    { name: 'xxxhdpi', portrait: [1280, 1920] },
  ];
  for (const { name, portrait } of splashDensities) {
    const [pw, ph] = portrait;
    await renderSplash(pw, ph, join(mobile, `android/app/src/main/res/drawable-port-${name}/splash.png`), 0.5);
    await renderSplash(ph, pw, join(mobile, `android/app/src/main/res/drawable-land-${name}/splash.png`), 0.5);
  }
}

console.log('Rasterising design library from design/svg/...');
for (const job of designJobs) {
  await rasterise(job);
}
await buildIco(ICON_SVG, ICO_SIZES, ICO_OUT);

console.log('\nDeploying web assets...');
await deployWeb();

console.log('\nDeploying mobile native icons...');
await deployMobile();

console.log('\nRendering splash screens...');
await renderSplashScreens();

console.log('\nDone.');
