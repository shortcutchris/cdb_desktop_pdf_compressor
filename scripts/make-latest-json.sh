#!/usr/bin/env bash
# Build the updater manifest (latest.json) from the signed build artifacts.
#
# Reads the macOS .app.tar.gz.sig (local build) and the Windows -setup.exe.sig
# (copied back to dist-windows/ by build-windows-remote.sh), and points the
# download URLs at the GitHub release assets for the current version.
#
# Run AFTER both platform builds, BEFORE creating the release. Output: latest.json
# Then upload latest.json + the .app.tar.gz + -setup.exe (+ .dmg/.msi) to the
# release `v<version>`; the updater endpoint serves .../releases/latest/download/latest.json.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
REPO="shortcutchris/cdb_desktop_pdf_compressor"

VERSION="$(grep -m1 '"version"' src-tauri/tauri.conf.json | sed -E 's/.*"version": *"([^"]+)".*/\1/')"
PUB_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BASE="https://github.com/$REPO/releases/download/v$VERSION"

MAC_SIG_FILE="src-tauri/target/release/bundle/macos/CDB PDF Compressor.app.tar.gz.sig"
WIN_SIG_FILE="dist-windows/CDB PDF Compressor_${VERSION}_x64-setup.exe.sig"
[ -f "$MAC_SIG_FILE" ] || { echo "macOS-Signatur fehlt: $MAC_SIG_FILE (erst build-macos.sh)"; exit 1; }
[ -f "$WIN_SIG_FILE" ] || { echo "Windows-Signatur fehlt: $WIN_SIG_FILE (erst build-windows-remote.sh)"; exit 1; }

MAC_SIG="$(cat "$MAC_SIG_FILE")"
WIN_SIG="$(cat "$WIN_SIG_FILE")"

# GitHub sanitizes spaces in asset names to dots in the download URL.
cat > latest.json <<EOF
{
  "version": "$VERSION",
  "pub_date": "$PUB_DATE",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$MAC_SIG",
      "url": "$BASE/CDB.PDF.Compressor_${VERSION}_aarch64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "$WIN_SIG",
      "url": "$BASE/CDB.PDF.Compressor_${VERSION}_x64-setup.exe"
    }
  }
}
EOF
echo "✓ latest.json für v$VERSION geschrieben"