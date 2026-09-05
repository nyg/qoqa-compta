#!/usr/bin/env bash
# Regenerates all app icons from the master SVG:
#   assets/icon.svg -> assets/icon.iconset/ (macOS), assets/icon.ico (Windows), public/favicon.ico (web)
# Requires librsvg (rsvg-convert) and ImageMagick (magick):
#   brew install librsvg imagemagick
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

padded() {
   local size=$1 out=$2 artwork margin
   artwork=$(awk -v s="$size" 'BEGIN { printf "%.4f", s * 1024 / 1204 }')
   margin=$(awk -v s="$size" 'BEGIN { printf "%.4f", s * 90 / 1204 }')
   rsvg-convert -w "$artwork" -h "$artwork" --page-width "$size" --page-height "$size" --left "$margin" --top "$margin" assets/icon.svg -o "$out"
}

# macOS iconset (converted to .icns by electrobun via iconutil)
for s in 16 32 128 256 512; do
   padded "$s" "assets/icon.iconset/icon_${s}x${s}.png"
done
padded 32 assets/icon.iconset/icon_16x16@2x.png
padded 64 assets/icon.iconset/icon_32x32@2x.png
padded 256 assets/icon.iconset/icon_128x128@2x.png
padded 512 assets/icon.iconset/icon_256x256@2x.png
padded 1024 assets/icon.iconset/icon_512x512@2x.png

# Windows .ico (embedded into launcher.exe by electrobun via rcedit)
for s in 16 24 32 48 64 128 256; do
   padded "$s" "$tmp/win_$s.png"
done
magick "$tmp"/win_{16,24,32,48,64,128,256}.png assets/icon.ico

mkdir -p public
for s in 16 32 48; do
   rsvg-convert -w "$s" -h "$s" assets/icon.svg -o "$tmp/favicon_$s.png"
done
magick "$tmp"/favicon_{16,32,48}.png public/favicon.ico

echo "Done."
