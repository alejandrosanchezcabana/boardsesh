# Boardsesh — Logo & Brand Assets

All exports are vector SVG. Open in any browser, Illustrator, Figma, Inkscape.

## Brand colors
- Coral (primary):     #d65a4f
- Ink (off-white):     #f4f1ea
- Background (near-black): #0e0e10
- Surface alt:         #17171a
- Ink dim:             #8a8780

## Route mark colors (top → bottom)
- Purple / start:  #c44a8a
- Cyan / hand:     #3fb8c4
- Green / foot:    #5fb27a
- Orange / finish: #e2a44d

## Type
- Display:   Archivo (700 / 800 / 900)
- Mono/UI:   JetBrains Mono (400 / 500)

## Folders
- svg/mark/        Primary mark in light/dark/coral surfaces and mono fallbacks
- svg/app-icon/    App icons at 512 and 1024 px
- svg/favicon/     32px browser favicon (no context dots)
- svg/lockup/      Wordmark + mark lockups
- svg/sticker/     Marketing stickers (round, slap, bumper, tagline, SENT)

## Notes for integration
- The mark scales fine to ~22px without context dots; below ~40px prefer
  `route-mark-no-context.svg` (or the favicon).
- For embroidery / single-channel print use the mono variants.
- Fonts must be installed by the consumer; SVGs reference Archivo + JetBrains Mono.
