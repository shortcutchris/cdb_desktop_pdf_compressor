# cdb_desktop_pdf_compressor

Ein **Open-Source-Desktop-Tool zum Komprimieren großer PDFs** — primär für macOS,
optional Windows. Zielgruppe: jeder, der eine große PDF auf dem Rechner hat und sie
schnell, lokal und ohne Upload-Dienst verkleinern will.

Kern ist die bewährte Kompressions-Engine aus dem `pdf-compress`-Skill des
Newsletter-Repos (Ghostscript-Wrapper mit `quality-percent → dpi`-Mapping). Diese
App gibt ihr eine native, drag-&-drop-fähige Oberfläche.

## Status

✅ **MVP läuft (macOS).** Tauri v2 + React/TS/Vite. Drag & Drop + Dateidialog,
Qualitäts-Slider (1–100 %) + Presets, Batch, Vorher/Nachher-Tabelle, Finder-artige
Versionierung, i18n (DE/EN), Theme-Umschalter (hell/dunkel/system), CDB-Brand-Icon
mit macOS-Hell/Dunkel-Umschaltung. Ghostscript ist self-contained gebündelt
(läuft ohne `brew install`). Windows-Build über CI vorbereitet.

- `src/`, `src-tauri/` — Tauri-v2-App
- `icon-src/` — Icon-Master (hell/dunkel), erzeugt via `scripts/gen-icon.py`
- `reference-skill/` — Engine-Referenz (`tools/compress.py`)
- `REQUIREMENTS.md` · `RESEARCH.md` · `LICENSE` (AGPL-3.0)

## Entwicklung

```bash
npm install
npm run tauri dev     # nutzt im Dev das System-gs; benötigt Rust/Cargo
```

> **Rust** einmalig: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

## Builds

**macOS** (Apple Silicon, mit gebündeltem gs + Hell/Dunkel-Icon):
```bash
brew install ghostscript dylibbundler
./scripts/build-macos.sh --dmg      # -> src-tauri/target/release/bundle/{macos,dmg}
```

**Windows** (auf einem Windows-Rechner — einmalig Node, Git, Rust+MSVC-C++-Build-Tools):
```powershell
# Ghostscript besorgen: offiziellen Installer mit 7-Zip entpacken
#   (das choco-Paket ist headless flaky). 7z x gs<ver>w64.exe -oC:\gs-extract
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1   # bundelt gs + baut .msi/.exe
# -> src-tauri\target\release\bundle\{msi,nsis}
```

**Windows-Remote-Build** (vom Mac aus, über SSH/Tailscale auf einen provisionierten Windows-Host):
```bash
./scripts/build-windows-remote.sh greyiron      # baut remote + holt Installer nach dist-windows/
```

**CI / Releases:** Ein Git-Tag `v*` pushen → `.github/workflows/release.yml` baut auf
macOS- **und** Windows-Runnern und hängt `.dmg`/`.msi`/`.exe` ans GitHub-Release.
```bash
git tag v0.1.0 && git push origin v0.1.0
```

## Eckdaten

- **100 % lokal & offline** — kein Upload, keine Cloud, kein Tracking
- **Open Source.** Wegen gebündeltem Ghostscript: Lizenz **AGPL-3.0**
- **Engine:** Ghostscript (`gs`), self-contained gebündelt pro Plattform
- **Plattform:** macOS (Apple Silicon) fertig; Windows über CI; Intel/Universal = Folgeschritt

## Hinweise

- Das `.app`/`.dmg` ist **ad-hoc signiert** (nicht notarisiert) → beim ersten Öffnen
  ggf. Rechtsklick → „Öffnen". Notarisierung ist ein offener Folgeschritt.
- `src-tauri/gs/` (gebündeltes Ghostscript) ist **gitignored** und wird beim Build
  via `scripts/bundle-gs.sh` (macOS) bzw. `scripts/bundle-gs.ps1` (Windows) erzeugt.
