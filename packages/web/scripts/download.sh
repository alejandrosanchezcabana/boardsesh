#!/bin/bash

# Base URL
kilter_url="https://api.kilterboardapp.com/img/"
tension_url="https://api.tensionboardapp2.com/img/"

kilter_images=(
"product_sizes_layouts_sets/47.png"
"product_sizes_layouts_sets/48.png"
"product_sizes_layouts_sets/49.png"
"product_sizes_layouts_sets/15_5_24.png"
"product_sizes_layouts_sets/53.png"
"product_sizes_layouts_sets/54.png"
"product_sizes_layouts_sets/55-v2.png"
"product_sizes_layouts_sets/56-v3.png"
"product_sizes_layouts_sets/55-v2.png"
"product_sizes_layouts_sets/56-v3.png"
"product_sizes_layouts_sets/59.png"
"product_sizes_layouts_sets/65-v2.png"
"product_sizes_layouts_sets/66-v2.png"
"product_sizes_layouts_sets/65-v2.png"
"product_sizes_layouts_sets/66-v2.png"
"product_sizes_layouts_sets/72.png"
"product_sizes_layouts_sets/73.png"
"product_sizes_layouts_sets/72.png"
"product_sizes_layouts_sets/73.png"
"product_sizes_layouts_sets/36-1.png"
"product_sizes_layouts_sets/38-1.png"
"product_sizes_layouts_sets/39-1.png"
"product_sizes_layouts_sets/41-1.png"
"product_sizes_layouts_sets/45-1.png"
"product_sizes_layouts_sets/46-1.png"
"product_sizes_layouts_sets/50-1.png"
"product_sizes_layouts_sets/51-1.png"
"product_sizes_layouts_sets/77-1.png"
"product_sizes_layouts_sets/78-1.png"
"product_sizes_layouts_sets/60-v3.png"
"product_sizes_layouts_sets/60-v3.png"
"product_sizes_layouts_sets/63-v3.png"
"product_sizes_layouts_sets/63-v3.png"
"product_sizes_layouts_sets/70-v2.png"
"product_sizes_layouts_sets/70-v2.png"
"product_sizes_layouts_sets/61-v3.png"
"product_sizes_layouts_sets/64-v3.png"
"product_sizes_layouts_sets/71-v3.png"
"product_sizes_layouts_sets/original-16x12-bolt-ons-v2.png"
"product_sizes_layouts_sets/original-16x12-screw-ons-v2.png"
"product_sizes_layouts_sets/61-v3.png")

# Array of image paths
tension_images=(
"product_sizes_layouts_sets/1.png"
"product_sizes_layouts_sets/2.png"
"product_sizes_layouts_sets/3.png"
"product_sizes_layouts_sets/4.png"
"product_sizes_layouts_sets/5.png"
"product_sizes_layouts_sets/6.png"
"product_sizes_layouts_sets/7.png"
"product_sizes_layouts_sets/8.png"
"product_sizes_layouts_sets/9.png"
"product_sizes_layouts_sets/10.png"
"product_sizes_layouts_sets/11.png"
"product_sizes_layouts_sets/12.png"
"product_sizes_layouts_sets/13.png"
"product_sizes_layouts_sets/14.png"
"product_sizes_layouts_sets/15.png"
"product_sizes_layouts_sets/16.png"
"product_sizes_layouts_sets/17.png"
"product_sizes_layouts_sets/18.png"
"product_sizes_layouts_sets/19.png"
"product_sizes_layouts_sets/20.png"
"product_sizes_layouts_sets/23.png"
"product_sizes_layouts_sets/25.png"
"product_sizes_layouts_sets/26.png"
"product_sizes_layouts_sets/27.png"
"product_sizes_layouts_sets/28.png"
"product_sizes_layouts_sets/12x12-tb2-wood.png"
"product_sizes_layouts_sets/12x12-tb2-plastic.png"
"product_sizes_layouts_sets/12x10-tb2-wood.png"
"product_sizes_layouts_sets/12x10-tb2-plastic.png"
"product_sizes_layouts_sets/8x12-tb2-wood.png"
"product_sizes_layouts_sets/8x12-tb2-plastic.png"
"product_sizes_layouts_sets/8x10-tb2-wood.png"
"product_sizes_layouts_sets/8x10-tb2-plastic.png"
"product_sizes_layouts_sets/21-2.png"
"product_sizes_layouts_sets/22-2.png"
"product_sizes_layouts_sets/24-2.png"
"product_sizes_layouts_sets/37.png"
"product_sizes_layouts_sets/38.png"
"product_sizes_layouts_sets/39.png"
"product_sizes_layouts_sets/40.png"
# Set 14/15 (Wood/Plastic Expansion) for size 10 are intentionally omitted —
# Aurora has not published hole_placements for those sets, so the generator
# drops them from SETS/IMAGE_FILENAMES (see HAS_PLACEMENTS_CLAUSE in
# packages/board-constants/scripts/generate-board-constants.ts). If Aurora
# ever publishes those placements, regenerating constants will re-introduce
# the references — re-add 41.png and 42.png here at that point.
)

# Loop through the array and download each image
for image in "${tension_images[@]}"
do
  echo $image
  wget "${tension_url}${image}" -P ../public/images/tension
done
