# Build a self-contained Ghostscript bundle for the Windows app.
#
# Mirrors scripts/bundle-gs.sh (macOS) but for Windows: copies gswin64c.exe +
# gsdll64.dll and the Resource/lib/font/ICC tree into src-tauri\gs\ using the
# SAME layout the macOS bundle uses, so the Rust resolve_gs() logic is shared.
#
# The result (src-tauri\gs\) is gitignored and regenerated on build.
#
# Usage:   pwsh scripts/bundle-gs.ps1 [-GsDir "C:\Program Files\gs\gs10.07.1"]
# If -GsDir is omitted, the newest install under C:\Program Files\gs\ is used.

param([string]$GsDir = "")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "src-tauri\gs"

if (-not $GsDir) {
    $cand = Get-ChildItem "C:\Program Files\gs" -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $cand) { throw "Keine Ghostscript-Installation unter C:\Program Files\gs gefunden. choco install ghostscript" }
    $GsDir = $cand.FullName
}
Write-Host "gs install : $GsDir"
Write-Host "ziel       : $dest"

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$dest\bin" | Out-Null
New-Item -ItemType Directory -Force -Path "$dest\share\ghostscript" | Out-Null

# binary + its single DLL dependency
Copy-Item "$GsDir\bin\gswin64c.exe" "$dest\bin\" -Force
Copy-Item "$GsDir\bin\gsdll64.dll"  "$dest\bin\" -Force

# resources, into the same share\ghostscript layout the macOS bundle uses.
# On Windows the init .ps files (gs_init.ps) live under lib\ — resolve_gs already
# includes the lib dir in GS_LIB, so this works without code changes.
foreach ($d in @("Resource", "lib", "iccprofiles", "fonts")) {
    if (Test-Path "$GsDir\$d") {
        Copy-Item "$GsDir\$d" "$dest\share\ghostscript\$d" -Recurse -Force
    }
}

# Bundle the VC++ 2015-2022 runtime DLLs gs links against, app-local (next to
# gswin64c.exe), so end-user machines WITHOUT the VC++ Redistributable can run
# it. The api-ms-win-crt-* (Universal CRT) forwarders are part of Windows 10/11
# itself, so they are intentionally NOT bundled.
$vcDlls = @("vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll")
foreach ($dll in $vcDlls) {
    $sys = Join-Path $env:SystemRoot "System32\$dll"
    if (Test-Path $sys) { Copy-Item $sys "$dest\bin\" -Force }
    else { Write-Warning "VC++-Runtime-DLL nicht gefunden: $dll (VC++ Redistributable installieren)" }
}

$size = "{0:N0} MB" -f ((Get-ChildItem $dest -Recurse | Measure-Object Length -Sum).Sum / 1MB)
Write-Host "OK Bundle erstellt: $size"
