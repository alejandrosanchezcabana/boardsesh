# Boardsesh asset pack

Generated from the V11/V12/V13/V15 black-circle icon variant.
Mark uses existing V-grade tokens directly, ascending in reading order from top-left:
TL=V11 #9C27B0 · TR=V12 #7B1FA2 · BL=V13 #6A1B9A · BR=V15 #4A148C.

Regenerate every PNG from `svg/icon-master.svg` with `bun scripts/rasterise-brand-assets.ts`.

## Contents

- `svg/` — vector sources for every asset (use these for further editing)
- `web/` — favicon PNGs at every standard size + manifest
- `ios/` — iOS app icon PNGs
- `android/` — Android launcher PNGs (legacy) + adaptive icon SVGs
- `social/` — Open Graph / Twitter share image (1200×630 PNG)

## HTML head snippet

See the "HTML drop-in" section on the assets page or the manifest below.

## Notes

- All PNGs are rasterised from the same canonical SVG so they're pixel-consistent.
- For PWA, use the 192px and 512px PNGs in `manifest.webmanifest`.
- Android adaptive icon: combine `ic_launcher_foreground.svg` + `ic_launcher_background.svg` per Android docs.
