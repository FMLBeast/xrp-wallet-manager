# App Icons

This directory contains the application icons for the XRP Wallet Manager.

## Current Status

A basic SVG icon (`icon.svg`) has been provided as a placeholder. You should replace this with a professional icon before release.

## How to Generate Icons from SVG

### Option 1: Using ImageMagick (Recommended)

```bash
# Install ImageMagick
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick
# Windows: Download from https://imagemagick.org/

# Generate PNG (all platforms)
convert -background none -density 1024 icon.svg -resize 512x512 icon.png

# Generate ICNS (macOS)
mkdir icon.iconset
for size in 16 32 64 128 256 512; do
  convert -background none -density 1024 icon.svg -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
  convert -background none -density 1024 icon.svg -resize $((size*2))x$((size*2)) icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset

# Generate ICO (Windows)
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

### Option 2: Using Online Converters

1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icon.svg`
3. Set size to 512x512
4. Download as `icon.png`

For ICNS (macOS):
- Use https://cloudconvert.com/png-to-icns

For ICO (Windows):
- Use https://cloudconvert.com/png-to-ico

### Option 3: Use a Professional Icon

For production releases, consider:
- Hiring a designer on Fiverr/Upwork
- Using icon generation services like IconKitchen
- Creating your own in Figma/Sketch/Adobe Illustrator

## Required Files

The build process expects these files:
- `icon.png` - 512x512 PNG (Linux)
- `icon.icns` - macOS icon bundle
- `icon.ico` - Windows icon file

## Quick Fix Script

Run this script to generate placeholder icons (requires ImageMagick):

```bash
cd assets
./generate-icons.sh
```

## Icon Design Guidelines

- Size: 512x512 minimum (for best quality)
- Format: Square with rounded corners
- Colors: Use brand colors (currently blue #2563eb and green #10b981)
- Background: Solid color or gradient
- Symbol: Clear, recognizable at small sizes
- Style: Modern, professional, matches Material Design
