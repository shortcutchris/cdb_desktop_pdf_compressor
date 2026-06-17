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

# 0) updater signing key (kept outside the repo). When present, tauri build
#    produces a signed .app.tar.gz for the in-app updater.
KEY="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/cdb-pdf-compressor.key}"
if [ -f "$KEY" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
fi

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

# 5b) The updater tarball is auto-built from the UN-patched .app, so rebuild it
#     from the icon-patched .app and re-sign it (if we have the updater key).
if [ -f "$KEY" ]; then
  MACOS_DIR="src-tauri/target/release/bundle/macos"
  TARGZ="$MACOS_DIR/CDB PDF Compressor.app.tar.gz"
  ( cd "$MACOS_DIR" && tar -czf "CDB PDF Compressor.app.tar.gz" "CDB PDF Compressor.app" )
  # key + password come from the exported env vars (don't also pass -f/-p)
  npx @tauri-apps/cli signer sign "$TARGZ" >/dev/null
  echo "✓ Updater-Tarball neu gepackt + signiert"
fi

# 6) optional: wrap the patched .app into a .dmg (pass --dmg)
if [[ "${1:-}" == "--dmg" ]]; then
  DMG_DIR="src-tauri/target/release/bundle/dmg"
  mkdir -p "$DMG_DIR"
  DMG="$DMG_DIR/CDB PDF Compressor.dmg"
  rm -f "$DMG"
  # Stage the .app next to an /Applications symlink so users drag-install.
  STAGE="$(mktemp -d)/CDB PDF Compressor"
  mkdir -p "$STAGE"
  cp -R "$APP" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -volname "CDB PDF Compressor" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
  rm -rf "$(dirname "$STAGE")"
  echo "✓ $DMG  (mit Applications-Verknüpfung)"
fi