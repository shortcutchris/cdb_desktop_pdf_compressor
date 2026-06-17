#!/usr/bin/env bash
# Build a self-contained Ghostscript bundle for the macOS app.
#
# Takes the locally installed (Homebrew) Ghostscript, collects all its non-system
# dylibs via dylibbundler (rewriting load paths to @executable_path/../lib), and
# copies the Resource/font/ICC tree. The result in src-tauri/gs/ is fully
# relocatable and is packaged into the .app via tauri.conf.json `bundle.resources`.
#
# This output is NOT committed to git (see .gitignore) — regenerate with:
#   ./scripts/bundle-gs.sh
#
# Prerequisites:  brew install ghostscript dylibbundler
# Note: arm64 only (matches the local Homebrew gs). Universal/Intel is a follow-up.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$SCRIPT_DIR/../src-tauri/gs"

command -v gs >/dev/null            || { echo "gs fehlt:  brew install ghostscript"; exit 1; }
command -v dylibbundler >/dev/null  || { echo "dylibbundler fehlt:  brew install dylibbundler"; exit 1; }

GS_BIN="$(readlink -f "$(command -v gs)")"
GS_PREFIX="$(cd "$(dirname "$GS_BIN")/.." && pwd)"   # …/Cellar/ghostscript/<ver>
SHARE_SRC="$GS_PREFIX/share/ghostscript"

[ -d "$SHARE_SRC" ] || { echo "gs share-Verzeichnis nicht gefunden unter $SHARE_SRC"; exit 1; }

echo "gs binary : $GS_BIN"
echo "gs share  : $SHARE_SRC"
echo "ziel      : $DEST"

rm -rf "$DEST"
mkdir -p "$DEST/bin" "$DEST/lib" "$DEST/share"
cp "$GS_BIN" "$DEST/bin/gs"
chmod u+w "$DEST/bin/gs"
cp -R "$SHARE_SRC" "$DEST/share/ghostscript"

echo "→ dylibbundler sammelt Dylibs und schreibt Ladepfade um…"
dylibbundler -of -b -x "$DEST/bin/gs" -d "$DEST/lib" -p '@executable_path/../lib' >/dev/null

echo "✓ Bundle erstellt:  $(du -sh "$DEST" | cut -f1)  ($(ls "$DEST/lib" | wc -l | tr -d ' ') Dylibs)"
