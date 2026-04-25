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
 *   app/favicon.ico                     (32x32 PNG renamed to .ico)
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

async function main() {
  const coralSvg = readFileSync(CORAL_ICON_SVG);
  const darkSvg = readFileSync(DARK_ICON_SVG);

  // Generate app icons from coral variant
  await Promise.all([
    sharp(coralSvg).resize(192, 192).png().toFile(resolve(webRoot, 'public/icons/icon-192.png')),

    sharp(coralSvg).resize(512, 512).png().toFile(resolve(webRoot, 'public/icons/icon-512.png')),

    sharp(coralSvg).resize(180, 180).png().toFile(resolve(webRoot, 'public/icons/apple-touch-icon.png')),

    // Generate favicon from dark icon variant (black rounded rectangle background)
    sharp(darkSvg)
      .resize(32, 32)
      .png()
      .toBuffer()
      .then((buf) => writeFileSync(resolve(webRoot, 'app/favicon.ico'), buf)),
  ]);

  console.info('Generated:');
  console.info('  public/icons/icon-192.png');
  console.info('  public/icons/icon-512.png');
  console.info('  public/icons/apple-touch-icon.png');
  console.info('  app/favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
