#!/usr/bin/env bash
# Generates assets/icon.iconset/ from docs/icon.svg using macOS sips + iconutil.
# Run once whenever the icon changes: bash scripts/make-iconset.sh
set -euo pipefail

SVG="docs/icon.svg"
ICONSET="assets/icon.iconset"

if [[ ! -f "$SVG" ]]; then
  echo "Error: $SVG not found" >&2
  exit 1
fi

mkdir -p "$ICONSET"

for size in 16 32 128 256 512; do
  sips -s format png "$SVG" --resampleWidth "$size"        --out "$ICONSET/icon_${size}x${size}.png"    > /dev/null
  sips -s format png "$SVG" --resampleWidth "$((size * 2))" --out "$ICONSET/icon_${size}x${size}@2x.png" > /dev/null
done

echo "✓ Icon set generated at $ICONSET"
echo "  Run 'iconutil -c icns $ICONSET' to also build a standalone .icns file."
