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

# Updater signing key (kept outside the repo). When present, tauri build
# produces a signed -setup.exe for the in-app updater.
$key = "$env:USERPROFILE\.tauri\cdb-pdf-compressor.key"
if (Test-Path $key) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $key -Raw
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "" }
    Write-Host "== Updater-Signing aktiv =="
}

Write-Host "== Bundling Ghostscript from $GsDir =="
& powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\bundle-gs.ps1" -GsDir $GsDir

Write-Host "== npm ci =="
npm ci

Write-Host "== tauri build =="
npm run tauri build

Write-Host "== Artefakte =="
Get-ChildItem "src-tauri\target\release\bundle" -Recurse -Include *.msi, *.exe |
    Select-Object -ExpandProperty FullName
