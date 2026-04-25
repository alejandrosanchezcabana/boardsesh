/**
 * Generate PNG icon assets from SVG sources.
 *
 * Run once from packages/web/:
 *   bunx tsx scripts/generate-icons.ts
 *
 * Outputs:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/apple-touch-icon.png  (180x180)
 *   public/icons/icon-maskable-512.png  (512x512, extra padding for maskable safe zone)
 *   app/favicon.ico                     (multi-size ICO: 16, 32, 48)
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const repoRoot = resolve(webRoot, '..', '..');

const CORAL_ICON_SVG = resolve(repoRoot, 'svg/app-icon/icon-coral-1024.svg');
const DARK_ICON_SVG = resolve(repoRoot, 'svg/app-icon/icon-dark-512.svg');

/** Wrap one or more PNG buffers in a valid ICO container (PNG-in-ICO). */
function buildIco(pngs: { buf: Buffer; width: number; height: number }[]): Buffer {
  // ICO header: 3 x uint16 (reserved=0, type=1 for ICO, image count)
  const headerSize = 6;
  const dirEntrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = ICO
  header.writeUInt16LE(pngs.length, 4);

  // Directory entries + image data
  let dataOffset = headerSize + dirEntrySize * pngs.length;
  const dirEntries: Buffer[] = [];

  for (const { buf, width, height } of pngs) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(width >= 256 ? 0 : width, 0); // 0 means 256
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image data size
    entry.writeUInt32LE(dataOffset, 12); // offset to image data
    dirEntries.push(entry);
    dataOffset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngs.map((p) => p.buf)]);
}

async function main() {
  const coralSvg = readFileSync(CORAL_ICON_SVG);
  const darkSvg = readFileSync(DARK_ICON_SVG);

  // Generate favicon PNGs at multiple sizes for the ICO container
  const [png16, png32, png48, ...rest] = await Promise.all([
    sharp(darkSvg).resize(16, 16).png().toBuffer(),
    sharp(darkSvg).resize(32, 32).png().toBuffer(),
    sharp(darkSvg).resize(48, 48).png().toBuffer(),

    // Generate app icons from coral variant
    sharp(coralSvg).resize(192, 192).png().toFile(resolve(webRoot, 'public/icons/icon-192.png')),
    sharp(coralSvg).resize(512, 512).png().toFile(resolve(webRoot, 'public/icons/icon-512.png')),
    sharp(coralSvg).resize(180, 180).png().toFile(resolve(webRoot, 'public/icons/apple-touch-icon.png')),
  ]);

  void rest; // sharp toFile results, unused

  // Generate maskable icon: render the coral icon at 410px centered on a 512px coral canvas.
  // This gives ~10% padding on each side, keeping content within the maskable safe zone.
  const coralSmall = await sharp(coralSvg).resize(410, 410).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 214, g: 90, b: 79, alpha: 1 } },
  })
    .composite([{ input: coralSmall, left: 51, top: 51 }])
    .png()
    .toFile(resolve(webRoot, 'public/icons/icon-maskable-512.png'));

  // Build a proper multi-size ICO file (16x16, 32x32, 48x48)
  const ico = buildIco([
    { buf: png16, width: 16, height: 16 },
    { buf: png32, width: 32, height: 32 },
    { buf: png48, width: 48, height: 48 },
  ]);
  writeFileSync(resolve(webRoot, 'app/favicon.ico'), ico);

  console.info('Generated:');
  console.info('  public/icons/icon-192.png');
  console.info('  public/icons/icon-512.png');
  console.info('  public/icons/icon-maskable-512.png');
  console.info('  public/icons/apple-touch-icon.png');
  console.info('  app/favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
