---
name: pdf-compress
description: "Use when a PDF is too large and should be shrunk for the repo, email, or LinkedIn upload — image-heavy slide decks, reports, carousels. Triggers: 'compress pdf', 'pdf verkleinern', 'komprimiere das pdf', 'pdf zu groß', 'shrink pdf'. Wraps Ghostscript with screen/ebook/printer presets; keeps text sharp at ebook. Run AFTER any PDF-producing skill (onepager, github-repo-report, linkedin-carousel) to keep committed PDFs lean."
version: 0.1.0
---

# pdf-compress — Ghostscript-PDF-Komprimierer

Verkleinert PDFs drastisch (bild-lastige Decks: −97 % bei ~150 dpi), ohne dass
Text unleserlich wird. Engine: Ghostscript (`gs`). Ideal als letzter Schritt
nach jedem PDF-Producer, damit nur schlanke PDFs ins Repo wandern.

## Voraussetzung

```bash
brew install ghostscript   # liefert `gs`; ohne gs bricht der Skill mit Hinweis ab
```

## Usage

```bash
~/.cdb-skills/venv/bin/python skills/pdf-compress/tools/compress.py <pdf|ordner> [...] \
  [--quality screen|ebook|printer] [--inplace]
```

| Flag | Wirkung |
|------|---------|
| `--quality` | `screen` (~72 dpi, kleinste) · `ebook` (~150 dpi, **Default, Text lesbar**) · `printer` (~300 dpi, höchste Treue) |
| `--inplace` | überschreibt das Original; sonst `<name>.compressed.pdf` daneben |
| Verzeichnis | rekursiv alle `*.pdf` (überspringt `*.compressed.pdf`) |

Gibt pro Datei Vorher→Nachher + Prozent aus; bei `--inplace` ohne Gewinn bleibt das Original unangetastet.

## Richtwerte (gemessen 2026-06-13)

| Qualität | Slide-Deck (16:9, 8 Seiten) | Einsatz |
|---|---|---|
| `screen` | 37 MB → 0,7 MB (−98 %) | Web/Feed, Text noch lesbar |
| `ebook` | 37 MB → 1,0 MB (−97 %) | **Default** — Screen/LinkedIn, Labels scharf |
| `printer` | 37 MB → 2,7 MB (−93 %) | Druck/Zoom |

## Konventionen

- **Standard `ebook`** für alles, was am Bildschirm/Feed läuft; `printer` nur für echten Druck.
- Nach Komprimierung kurz QC: eine Seite rastern (`gs -sDEVICE=png16m -r110 -dFirstPage=1 -dLastPage=1 -o qc.png in.pdf`) und auf Lesbarkeit prüfen.
- Große, abgeleitete PDFs vor dem Committen verkleinern (siehe `docs/MAINTENANCE.md` Medien-Policy). Nach `--inplace` sind die Decks klein genug, um getrackt zu werden.

## Integration

Nach `skills/onepager`, `skills/github-repo-report` oder `linkedin-carousel`
optional drüberlaufen lassen — hält committete PDFs lean. Engine ist self-contained
(nur `gs` + stdlib), keine Python-Deps.
