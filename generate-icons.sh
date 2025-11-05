#!/bin/bash

# XRP Wallet Manager Icon Generation Script
# Generates all required icon formats from SVG source

set -e

echo "🎯 XRP Wallet Manager Icon Generator"
echo "====================================="

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed!"
    echo "Please install it first:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

# Create assets directory if it doesn't exist
mkdir -p assets

# Source SVG file
SVG_SOURCE="assets/icon.svg"

if [ ! -f "$SVG_SOURCE" ]; then
    echo "❌ Source SVG file not found: $SVG_SOURCE"
    exit 1
fi

echo "📁 Source: $SVG_SOURCE"
echo ""

# Generate PNG icon for Linux
echo "🐧 Generating Linux PNG icon..."
convert "$SVG_SOURCE" -resize 512x512 "assets/icon.png"
echo "✅ Created: assets/icon.png (512x512)"

# Generate ICO icon for Windows (multiple sizes embedded)
echo "🪟 Generating Windows ICO icon..."
convert "$SVG_SOURCE" -resize 256x256 \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 16x16 \) \
    -delete 0 "assets/icon.ico"
echo "✅ Created: assets/icon.ico (multi-size)"

# Generate ICNS icon for macOS
echo "🍎 Generating macOS ICNS icon..."

# Create temporary directory for iconset
TEMP_ICONSET="assets/temp.iconset"
mkdir -p "$TEMP_ICONSET"

# Generate all required sizes for macOS iconset
declare -a sizes=(
    "16x16"
    "32x32"
    "32x32@2x"
    "128x128"
    "128x128@2x"
    "256x256"
    "256x256@2x"
    "512x512"
    "512x512@2x"
)

declare -a actual_sizes=(
    "16"
    "32"
    "64"
    "128"
    "256"
    "256"
    "512"
    "512"
    "1024"
)

for i in "${!sizes[@]}"; do
    size_name="${sizes[$i]}"
    actual_size="${actual_sizes[$i]}"

    echo "  📐 Generating icon_${size_name}.png (${actual_size}x${actual_size})"
    convert "$SVG_SOURCE" -resize "${actual_size}x${actual_size}" "$TEMP_ICONSET/icon_${size_name}.png"
done

# Convert iconset to ICNS
if command -v iconutil &> /dev/null; then
    echo "  🔧 Converting to ICNS using iconutil..."
    iconutil -c icns "$TEMP_ICONSET" -o "assets/icon.icns"
    echo "✅ Created: assets/icon.icns"
else
    echo "⚠️  iconutil not found (macOS only). Trying alternative method..."
    if command -v png2icns &> /dev/null; then
        png2icns "assets/icon.icns" "$TEMP_ICONSET"/*.png
        echo "✅ Created: assets/icon.icns"
    else
        echo "❌ Cannot create ICNS file. Please run this on macOS or install png2icns"
    fi
fi

# Cleanup temporary iconset
rm -rf "$TEMP_ICONSET"

# Generate favicon for web (optional)
echo "🌐 Generating favicon for web..."
convert "$SVG_SOURCE" -resize 32x32 "assets/favicon.ico"
convert "$SVG_SOURCE" -resize 16x16 "assets/favicon-16x16.png"
convert "$SVG_SOURCE" -resize 32x32 "assets/favicon-32x32.png"
echo "✅ Created: assets/favicon.ico, favicon-16x16.png, favicon-32x32.png"

echo ""
echo "🎉 Icon generation complete!"
echo ""
echo "Generated files:"
echo "  📁 assets/icon.png      (Linux - 512x512)"
echo "  📁 assets/icon.ico      (Windows - multi-size)"
echo "  📁 assets/icon.icns     (macOS - multi-size)"
echo "  📁 assets/favicon.*     (Web icons)"
echo ""
echo "Your Electron app is now ready with all platform icons! 🚀"
echo ""
echo "To test the icons:"
echo "  1. Run: npm run electron-pack"
echo "  2. Check the generated app in dist-electron/"
echo ""