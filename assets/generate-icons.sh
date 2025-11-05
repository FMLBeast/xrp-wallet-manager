#!/bin/bash

# Icon Generation Script for XRP Wallet Manager
# Requires ImageMagick: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)

set -e

echo "🎨 Generating XRP Wallet Manager icons..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found!"
    echo "Install it with:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/"
    exit 1
fi

# Check if SVG exists
if [ ! -f "icon.svg" ]; then
    echo "❌ icon.svg not found in assets directory!"
    exit 1
fi

echo "📐 Generating PNG (512x512)..."
convert -background none -density 1024 icon.svg -resize 512x512 icon.png

echo "🍎 Generating ICNS (macOS)..."
mkdir -p icon.iconset
for size in 16 32 64 128 256 512; do
    convert -background none -density 1024 icon.svg -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
    convert -background none -density 1024 icon.svg -resize $((size*2))x$((size*2)) icon.iconset/icon_${size}x${size}@2x.png
done

# Check if iconutil is available (macOS only)
if command -v iconutil &> /dev/null; then
    iconutil -c icns icon.iconset -o icon.icns
    echo "✅ Created icon.icns"
else
    echo "⚠️  iconutil not found (macOS only). Skipping ICNS generation."
    echo "   Use an online converter to create icon.icns from icon.png"
fi

rm -rf icon.iconset

echo "🪟 Generating ICO (Windows)..."
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico

echo ""
echo "✅ Icon generation complete!"
echo ""
echo "Generated files:"
ls -lh icon.png icon.icns icon.ico 2>/dev/null || ls -lh icon.png icon.ico 2>/dev/null || ls -lh icon.png
echo ""
echo "🚀 You can now run: npm run dist"
