# Build the Windows .msi / .exe ON a Windows machine.
#
# Prereqs on the machine (one-time): Node, Git, Rust (rustup, MSVC host),
# MSVC C++ Build Tools (VS 2022 "Desktop development with C++"), and a
# Ghostscript file tree to bundle from (-GsDir, default C:\gs-extract — extract
# the official gs installer with 7-Zip:  7z x gs<ver>w64.exe -oC:\gs-extract).
#
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1

param([string]$GsDir = "C:\gs-extract")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# cargo on PATH (rustup is installed with --no-modify-path on headless setups)
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path

# Updater signing key (kept outside the repo).
$key = "$env:USERPROFILE\.tauri\cdb-pdf-compressor.key"

Write-Host "== Bundling Ghostscript from $GsDir =="
& powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\bundle-gs.ps1" -GsDir $GsDir

Write-Host "== npm ci =="
npm ci

# Build WITHOUT auto-signing (tauri's in-bundle signing prompts for the password
# on a headless SSH session and hangs). We sign the updater artifact afterwards
# with explicit -f/-p, which is fully non-interactive.
Write-Host "== tauri build =="
npm run tauri build

if (Test-Path $key) {
    Write-Host "== Updater-Artefakt signieren =="
    # newest -setup.exe = the one we just built (old versions linger in the dir)
    $setup = Get-ChildItem "src-tauri\target\release\bundle\nsis" -Filter *-setup.exe |
        Sort-Object LastWriteTime | Select-Object -Last 1 -ExpandProperty FullName
    & cmd /c "npx @tauri-apps/cli signer sign -f `"$key`" -p `"`" `"$setup`""
}

Write-Host "== Artefakte =="
Get-ChildItem "src-tauri\target\release\bundle" -Recurse -Include *.msi, *.exe, *.sig |
    Select-Object -ExpandProperty FullName
