#!/bin/bash
# Generate thumbnail-sized AVIF images for board thumbnails.
# Resizes PNGs to max 416px wide (2x retina for 208px containers) and encodes as AVIF.
# Requires: sips (macOS built-in), avifenc (brew install libavif)
#
# Usage: bash packages/web/scripts/generate-thumbnails.sh
# Run from the repo root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../public"

MAX_WIDTH=416
QUALITY=40
SPEED=4

converted=0
skipped=0
total_size=0

convert_thumbnail() {
  local png_file="$1"
  local dir="$(dirname "$png_file")"
  local basename="$(basename "$png_file" .png)"
  local thumbs_dir="$dir/thumbs"
  local avif_file="$thumbs_dir/$basename.avif"

  mkdir -p "$thumbs_dir"

  # Skip if thumbnail exists and is newer than source
  if [[ -f "$avif_file" && "$avif_file" -nt "$png_file" ]]; then
    skipped=$((skipped + 1))
    return
  fi

  # Create temp resized PNG
  local tmp_png
  tmp_png=$(mktemp /tmp/thumb_XXXXXX.png)
  cp "$png_file" "$tmp_png"

  # Get current width
  local cur_width
  cur_width=$(sips -g pixelWidth "$tmp_png" 2>/dev/null | awk '/pixelWidth/{print $2}')

  # Only resize if wider than target
  if [[ "$cur_width" -gt "$MAX_WIDTH" ]]; then
    sips --resampleWidth "$MAX_WIDTH" "$tmp_png" --out "$tmp_png" >/dev/null 2>&1
  fi

  # Encode to AVIF
  avifenc --min 0 --max 63 -q "$QUALITY" -s "$SPEED" "$tmp_png" "$avif_file" 2>/dev/null

  local avif_size
  avif_size=$(stat -f%z "$avif_file" 2>/dev/null || stat -c%s "$avif_file")
  total_size=$((total_size + avif_size))
  converted=$((converted + 1))

  rm -f "$tmp_png"
  echo "  $(basename "$png_file") → thumbs/$basename.avif  ($(( avif_size / 1024 ))KB)"
}

echo "Generating thumbnail AVIFs (max ${MAX_WIDTH}px wide, quality=$QUALITY)..."
echo ""

# Kilter board images
echo "Kilter:"
for f in "$PUBLIC_DIR"/images/kilter/product_sizes_layouts_sets/*.png; do
  [[ -f "$f" ]] && convert_thumbnail "$f"
done
echo ""

# Tension board images
echo "Tension:"
for f in "$PUBLIC_DIR"/images/tension/product_sizes_layouts_sets/*.png; do
  [[ -f "$f" ]] && convert_thumbnail "$f"
done
echo ""

# MoonBoard images (recursive)
echo "MoonBoard:"
while IFS= read -r -d '' f; do
  convert_thumbnail "$f"
done < <(find "$PUBLIC_DIR/images/moonboard" -name "*.png" -print0)
echo ""

# Summary
echo "---"
echo "Converted: $converted files"
echo "Skipped (already up to date): $skipped files"
if [[ $converted -gt 0 ]]; then
  echo "Total thumbnail size: $((total_size / 1024)) KB"
fi
