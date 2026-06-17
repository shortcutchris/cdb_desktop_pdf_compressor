# Recherche — Engines, Bibliotheken, Frameworks, Vorbilder

Stand: 2026-06-17. Kontext: Open-Source-PDF-Kompressor-Desktop-App, primär macOS,
kein Verkauf. Frage: Was gibt es schon, worauf bauen wir auf, womit bauen wir?

---

## 1. Kompressions-Engines / Bibliotheken

| Tool | Was es tut | Lizenz | Eignung für uns |
|---|---|---|---|
| **Ghostscript (`gs`)** | De-facto-Standard. Baut PDF neu auf, downsamplt Bilder auf Ziel-DPI. Genau das, was `compress.py` heute nutzt. | **AGPL-3.0** (oder kommerzielle Lizenz von Artifex) | ✅ **Haupt-Engine.** Bei Open-Source-App ist AGPL unproblematisch — App wird dann ebenfalls AGPL. |
| **pikepdf** (libqpdf-Binding, Python) | Verlustfrei: optimiert Streams/Bilder ohne Qualitätsverlust. Gut als **Fallback**, wenn `gs` an einer PDF scheitert. | MPL-2.0 (libqpdf) | ✅ Optionaler Fallback (Robustheit) — siehe minimalpdfcompress. |
| **qpdf** | Struktur-Transformationen, Linearisierung; weniger Bild-Downsampling. | Apache-2.0 | 🔸 Ergänzend (Linearisierung), kein Ersatz für `gs`-Downsampling. |
| **mutool / MuPDF** | Leichtgewichtig, schnell, Basis-Optimierung; weniger Kontrolle über DPI/Bildqualität. | AGPL-3.0 | 🔸 Alternative zu `gs`, aber gleiche Lizenz-Klasse + weniger Tuning. |
| **pngquant / oxipng / ECT / jbig2** | Spezial-Optimierer pro Bildformat in einer **Pipeline** nach `gs`. | diverse (OSS) | 🔸 „Advanced"-Modus später — holt zusätzliche % raus (siehe minimalpdfcompress). |

**Fazit Engine:** Bei `gs` bleiben (bewährt, beste DPI-Kontrolle, unsere Engine läuft schon).
**pikepdf als Fallback** ist der lohnendste Zusatz für Robustheit. Multi-Tool-Pipelines
komprimieren etwas stärker, sind aber langsamer und komplexer — etwas für später, nicht MVP.

---

## 2. Vorhandene Open-Source-Apps (Vorbilder — nicht neu erfinden)

| Projekt | Stack | Plattform | Lizenz | Was wir lernen / übernehmen |
|---|---|---|---|---|
| **andrewtliem/MAC-PDFcompressor** | **SwiftUI** | macOS (Apple Silicon) | AGPL-3.0 | Fast exakt unser Ziel: Drag-&-Drop-Batch, Presets, **Metadaten entfernen**, Ergebnis-Tabelle (Original/Komprimiert/Ersparnis). **Bündelt statisch kompiliertes `gs` im .app** → genau unser N4-Pattern. |
| **GhostPDF** (alternativeto) | SwiftUI | macOS (Intel + Apple Silicon), offline | OSS | Native Mac-Referenz; macht zusätzlich Merge/Split/Encrypt (für uns Non-Goal). Beweist: SwiftUI-Weg ist tragfähig. |
| **deminimis/minimalpdfcompress** | Tkinter (Python) | Windows | AGPL-3.0 | Bestes **Pipeline-Vorbild**: Lossy (gs+DPI-Slider → pngquant/oxipng/ECT/jbig2) vs. Lossless (pikepdf) + cpdf-Linearisierung. Modi: Kompression / Lossless / PDF-A / Bilder entfernen. Gut für unsere „Soll/Kann"-Roadmap. |
| **SuikoHero38/pdf-compressor-cli** | Python CLI | macOS | OSS | „Ghostscript-first mit pikepdf-Fallback, skip if not smaller" — bestätigt unser `compress.py`-Verhalten (Kein-Gewinn-Schutz) + Fallback-Idee. |
| **alizangeneh/pdf-compressor** | Python + GUI | Cross | OSS | Drag-&-Drop-GUI mit DPI-Control — schlichtes Referenz-UI. |
| **ColorMan777/GhostScript-PDF-compression-GUI** | GUI | — | OSS | Minimaler gs-GUI-Wrapper. |

**Wichtigste Erkenntnis:** **MAC-PDFcompressor** ist praktisch ein Schwesterprojekt
(SwiftUI + gebündeltes statisches `gs`, AGPL). Wir müssen das Rad nicht neu erfinden —
wir können dessen Bundling-Ansatz und Feature-Set als Blaupause nehmen und mit unserer
`quality-percent`-Engine + CDB-Look differenzieren.

---

## 3. Framework-Optionen

| Kriterium | **SwiftUI (nativ)** | **Tauri v2** | Python (Tkinter/PyInstaller) |
|---|---|---|---|
| Bundle-Größe | sehr klein | ~2–10 MB (Web-View nativ + Rust) | mittel–groß |
| RAM / Start | bestes | ~30–50 MB, ~4× schneller als Electron | mittel |
| Plattform | **nur macOS** | **macOS + Windows + Linux** | cross |
| `gs` bündeln | Tools/-Ordner im .app (bewährt: MAC-PDFcompressor) | Sidecar-Binary (Tauri-`externalBin`) | mitgeliefertes Binary |
| Frontend-Skill | Swift (neu für Chris) | **React/Vite/Tailwind** — nutzt Chris' vorhandenen `app/`-Stack | Python |
| Signing/Notarize | nativ, gut dokumentiert | unterstützt, etwas mehr Setup | mühsam |

> Branchen-Daumenregel 2026: neue Desktop-App in **Tauri v2** starten, außer es gibt
> einen Grund dagegen. Tauri-Bundles sind ~25× kleiner als Electron, RAM 58–75 % niedriger.
> Electron nur, wenn maximale Ökosystem-Reife / identisches Chromium-Rendering nötig ist —
> für uns nicht der Fall.

---

## 4. Empfehlung

**Primär-Empfehlung: Tauri v2** (React + Vite + Tailwind Frontend, Rust-Core, `gs` als Sidecar-Binary).

Begründung:
1. **Chris' vorhandener Stack:** Das Newsletter-`app/` ist bereits React + Vite + Tailwind v4 + shadcn (Schwarz-Weiß). Frontend-Know-how und Look lassen sich 1:1 wiederverwenden.
2. **Mac zuerst, Windows als Option offen** — genau Tauris Stärke; SwiftUI würde Windows ausschließen.
3. **Schlank** (N2): 2–10 MB statt Electron-Ballast.
4. `gs` lässt sich als Tauri-Sidecar bündeln (kein `brew install` nötig → N4 erfüllt).

**Wenn es ausschließlich Mac bliebe und maximale Nativität/kleinster Footprint zählt:**
SwiftUI (wie MAC-PDFcompressor) ist die elegantere, aber Mac-exklusive Wahl und erfordert Swift.

**MVP-Schnitt (egal welches Framework):** F1–F8 aus `REQUIREMENTS.md` + gebündeltes `gs`,
Engine-Logik 1:1 aus `reference-skill/tools/compress.py` portiert.

---

## Quellen

- [andrewtliem/MAC-PDFcompressor (SwiftUI, gebündeltes gs, AGPL)](https://github.com/andrewtliem/MAC-PDFcompressor)
- [deminimis/minimalpdfcompress (gs+pikepdf+pngquant-Pipeline)](https://github.com/deminimis/minimalpdfcompress)
- [SuikoHero38/pdf-compressor-cli (gs-first + pikepdf-Fallback)](https://github.com/SuikoHero38/pdf-compressor-cli)
- [alizangeneh/pdf-compressor (Drag-&-Drop-GUI, DPI-Control)](https://github.com/alizangeneh/pdf-compressor)
- [ColorMan777/GhostScript-PDF-compression-GUI](https://github.com/ColorMan777/GhostScript-PDF-compression-GUI)
- [pikepdf Dokumentation](https://pikepdf.readthedocs.io/)
- [Ghostscript vs. andere CLI-Tools (FunWithLinux)](https://www.funwithlinux.net/blog/optimize-pdf-files-with-ghostscript-or-other/)
- [Tauri v2 vs Electron 2026 — Bundle/RAM/Security (PkgPulse)](https://www.pkgpulse.com/guides/electron-vs-tauri-2026)
- [Tauri v2 vs Electron — The Honest Comparison (buildmvpfast)](https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026)
