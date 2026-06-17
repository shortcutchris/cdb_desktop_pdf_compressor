#!/usr/bin/env bash
# Build the Windows installers on the remote Windows machine over SSH/Tailscale
# and copy them back to ./dist-windows/ on the Mac.
#
# Prereqs:
#   - SSH host alias (default: greyiron) reachable via Tailscale, key auth
#   - That machine provisioned per scripts/build-windows.ps1 (Node/Git/Rust/MSVC/gs)
#   - A clone of this repo on the machine (default: C:\Users\chubm\cdbpdf)
#
# Usage:  ./scripts/build-windows-remote.sh [ssh-host] [remote-repo-path]

set -euo pipefail
HOST="${1:-greyiron}"
REPO="${2:-C:/Users/chubm/cdbpdf}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Remote build on $HOST ($REPO) =="
# Hard-reset to origin/main (local changes like a rebuilt Cargo.lock must never
# block the sync), then build via the in-repo PowerShell script.
ssh "$HOST" "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Set-Location '$REPO'; git fetch origin; git reset --hard origin/main; powershell -ExecutionPolicy Bypass -File scripts\\build-windows.ps1\""

echo "== Copying installers back to dist-windows/ =="
mkdir -p "$ROOT/dist-windows"
# -O forces the legacy scp protocol so the remote shell expands the *.exe/*.msi glob
# (the default SFTP protocol does not glob -> "No such file").
scp -O "$HOST:$REPO/src-tauri/target/release/bundle/nsis/*.exe" "$ROOT/dist-windows/" || true
scp -O "$HOST:$REPO/src-tauri/target/release/bundle/msi/*.msi" "$ROOT/dist-windows/" || true
ls -la "$ROOT/dist-windows/"
