#!/bin/bash
# Convert all PNG board and help images to AVIF format.
# Requires: avifenc (brew install libavif)
#
# Usage: bash packages/web/scripts/convert-to-avif.sh
# Run from the repo root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../public"

# Quality 60-70 for AVIF gives comparable visual quality to WebP q80 / PNG
QUALITY=65
SPEED=4  # 0=slowest/best, 10=fastest/worst. 4 is a good balance.

converted=0
skipped=0
total_png_size=0
total_avif_size=0

convert_file() {
  local png_file="$1"
  local avif_file="${png_file%.png}.avif"

  # Skip if avif exists and is newer than the png source
  if [[ -f "$avif_file" && "$avif_file" -nt "$png_file" ]]; then
    skipped=$((skipped + 1))
    return
  fi

  avifenc --min 0 --max 63 -q "$QUALITY" -s "$SPEED" "$png_file" "$avif_file" 2>/dev/null

  local png_size avif_size
  png_size=$(stat -f%z "$png_file" 2>/dev/null || stat -c%s "$png_file")
  avif_size=$(stat -f%z "$avif_file" 2>/dev/null || stat -c%s "$avif_file")

  total_png_size=$((total_png_size + png_size))
  total_avif_size=$((total_avif_size + avif_size))
  converted=$((converted + 1))

  local savings=$(( (png_size - avif_size) * 100 / png_size ))
  echo "  $(basename "$png_file") → $(basename "$avif_file")  (${savings}% smaller)"
}

echo "Converting board images to AVIF (quality=$QUALITY, speed=$SPEED)..."
echo ""

# Kilter board images
echo "Kilter:"
for f in "$PUBLIC_DIR"/images/kilter/product_sizes_layouts_sets/*.png; do
  [[ -f "$f" ]] && convert_file "$f"
done
echo ""

# Tension board images
echo "Tension:"
for f in "$PUBLIC_DIR"/images/tension/product_sizes_layouts_sets/*.png; do
  [[ -f "$f" ]] && convert_file "$f"
done
echo ""

# MoonBoard images (recursive)
echo "MoonBoard:"
while IFS= read -r -d '' f; do
  convert_file "$f"
done < <(find "$PUBLIC_DIR/images/moonboard" -name "*.png" -print0)
echo ""

# Help images
echo "Help:"
for f in "$PUBLIC_DIR"/help/*.png; do
  [[ -f "$f" ]] && convert_file "$f"
done
echo ""

# Summary
echo "---"
echo "Converted: $converted files"
echo "Skipped (already up to date): $skipped files"
if [[ $converted -gt 0 ]]; then
  total_savings=$(( (total_png_size - total_avif_size) * 100 / total_png_size ))
  echo "PNG total:  $((total_png_size / 1024)) KB"
  echo "AVIF total: $((total_avif_size / 1024)) KB"
  echo "Savings:    ${total_savings}%"
fi
