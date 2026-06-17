#!/usr/bin/env bash
# Build the macOS .app with a self-contained Ghostscript AND a light/dark
# adaptive app icon (macOS swaps the icon with the system appearance).
#
# Tauri only ships a plain .icns, which can't carry a dark variant. So we
# compile an asset catalog (Assets.car) with light+dark AppIcon via actool and
# inject it into the built .app, then re-sign.
#
# Prerequisites: Xcode command line tools (actool, sips, codesign), node, Rust,
#                brew install ghostscript dylibbundler

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1) self-contained Ghostscript bundle
[ -f src-tauri/gs/bin/gs ] || ./scripts/bundle-gs.sh

# 2) regenerate the appicon sizes from the masters and compile the catalog
SET="src-tauri/macos-appicon/AppIcon.xcassets/AppIcon.appiconset"
for kind in light dark; do
  for px in 16 32 64 128 256 512 1024; do
    sips -z "$px" "$px" "icon-src/icon-$kind.png" --out "$SET/icon_${kind}_${px}.png" >/dev/null
  done
done
CAR_OUT="$(mktemp -d)"
actool src-tauri/macos-appicon/AppIcon.xcassets --compile "$CAR_OUT" --platform macosx \
  --minimum-deployment-target 11.0 --app-icon AppIcon \
  --output-partial-info-plist "$CAR_OUT/partial.plist" >/dev/null
echo "✓ Asset-Katalog (hell+dunkel) kompiliert"

# 3) build the .app only (we patch it, then a .dmg can be made from the result)
npm run tauri build -- --bundles app

APP="src-tauri/target/release/bundle/macos/CDB PDF Compressor.app"

# 4) inject the adaptive icon + point Info.plist at it
cp "$CAR_OUT/Assets.car" "$APP/Contents/Resources/Assets.car"
cp "$CAR_OUT/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
plutil -replace CFBundleIconName -string AppIcon "$APP/Contents/Info.plist"
plutil -replace CFBundleIconFile -string AppIcon "$APP/Contents/Info.plist"

# 5) re-sign (ad-hoc) because we changed bundle contents
codesign --force --deep -s - "$APP"

echo "✓ $APP  (light/dark adaptive icon, bundled gs)"