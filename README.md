# cdb_desktop_pdf_compressor

Ein **Open-Source-Desktop-Tool zum Komprimieren großer PDFs** — primär für macOS,
optional Windows. Zielgruppe: jeder, der eine große PDF auf dem Rechner hat und sie
schnell, lokal und ohne Upload-Dienst verkleinern will.

Kern ist die bewährte Kompressions-Engine aus dem `pdf-compress`-Skill des
Newsletter-Repos (Ghostscript-Wrapper mit `quality-percent → dpi`-Mapping). Diese
App gibt ihr eine native, drag-&-drop-fähige Oberfläche.

## Status

🌱 **Vorbereitung / Konzept.** Noch kein App-Code. Vorhanden:

- `reference-skill/` — 1:1-Kopie des `pdf-compress`-Skills (Engine-Referenz: `tools/compress.py`)
- `REQUIREMENTS.md` — Funktions- und Nicht-Funktionsanforderungen
- `RESEARCH.md` — Markt-/Bibliotheks-/Framework-Recherche + Empfehlung

## Eckdaten

- **100 % lokal & offline** — kein Upload, keine Cloud, kein Tracking
- **Open Source** (kein Verkauf). Wegen gebündeltem Ghostscript: Lizenz **AGPL-3.0**
- **Engine:** Ghostscript (`gs`), optional pikepdf-Fallback für problematische PDFs
- **Plattform:** macOS zuerst (Apple Silicon + Intel), Windows als Option

## Nächster Schritt

Framework-Entscheidung treffen (siehe `RESEARCH.md`, Abschnitt „Empfehlung"),
dann Projekt-Scaffold + MVP.
