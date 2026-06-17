# Anforderungen — cdb_desktop_pdf_compressor

Stand: 2026-06-17 · Quelle Engine: `reference-skill/tools/compress.py`

## 1. Vision

Eine kleine, schnelle Desktop-App, die das Verkleinern großer PDFs so einfach macht
wie „Datei reinziehen → fertig". Lokal, offline, ohne Account. Open Source.

**Zielnutzer:** jeder mit einer zu großen PDF (Slide-Deck, Report, Scan) auf dem Mac.
Kein Fachwissen über DPI/Ghostscript nötig — der Default muss einfach gut sein.

## 2. Funktionale Anforderungen

### Muss (MVP)
- **F1 — Drag & Drop:** Eine oder mehrere PDFs ins Fenster ziehen; alternativ „Dateien wählen…".
- **F2 — Batch:** Mehrere PDFs in einem Durchgang komprimieren.
- **F3 — Qualitäts-Regler:** Primär-Knopf = `quality-percent` (1–100), gemappt auf
  72–300 dpi wie in `compress.py` (`pct_to_dpi`). Default **80 %** (≈ 254 dpi, scharf).
- **F4 — Presets:** Schnellwahl `screen` / `ebook` / `printer` als Ein-Klick-Alternative zum Regler.
- **F5 — Vorher/Nachher:** Pro Datei Originalgröße → komprimierte Größe → Ersparnis in %
  (Tabelle, wie `compress.py` sie heute schon textuell ausgibt).
- **F6 — Ausgabe-Modus:** „Kopie daneben" (`<name>.compressed.pdf`, Default) **oder** „Original ersetzen" (in-place).
- **F7 — Kein-Gewinn-Schutz:** Wenn das Ergebnis nicht kleiner ist, Original unangetastet lassen (Logik existiert in `compress.py`).
- **F8 — Ergebnis öffnen:** „Im Finder zeigen" / komprimierte Datei direkt öffnen.

### Soll (v1.x)
- **F9 — Live-Vorschau/Schätzung** der Zielgröße bei Regler-Bewegung.
- **F10 — Metadaten entfernen** (optional, weitere Ersparnis — wie MAC-PDFcompressor).
- **F11 — Graustufen-Konvertierung** als optionaler Schalter.
- **F12 — Ordner rekursiv** verarbeiten (`compress.py` kann das bereits via `rglob`).
- **F13 — Fortschrittsanzeige** bei großen/vielen Dateien.
- **F14 — QC-Vorschau:** erste Seite des Ergebnisses als Thumbnail rastern (Lesbarkeits-Check).

### Kann (später)
- **F15 — pikepdf-Fallback,** wenn Ghostscript an einer PDF scheitert (Robustheit).
- **F16 — Windows-Build.**
- **F17 — Drag-out:** komprimierte Datei direkt aus der App in Mail/Finder ziehen.

## 3. Nicht-funktionale Anforderungen
- **N1 — Offline:** keinerlei Netzwerkzugriff; PDFs verlassen den Rechner nie.
- **N2 — Schlank:** kleines Installer-/Bundle-Format (siehe RESEARCH zu Tauri/SwiftUI).
- **N3 — Apple Silicon + Intel** (Universal Binary) für macOS.
- **N4 — Engine gebündelt:** Nutzer soll **kein** `brew install ghostscript` brauchen —
  `gs` (oder Alternative) muss in der App stecken. Konsequenz: **AGPL-3.0** für die App.
- **N5 — Signierung/Notarisierung** für Mac, damit Gatekeeper die App ohne Rechtsklick-Workaround startet (relevant, da „jeder am Mac").
- **N6 — Verständliche Defaults:** ohne Einstellungen muss ein guter Standard laufen.

## 4. Abgrenzung (Non-Goals)
- Kein PDF-Editor (Merge/Split/Sign) — reiner Kompressor.
- Kein Online-Dienst, keine Konten, kein Sync.
- Keine OCR.

## 5. Offene Entscheidungen
- **E1 — Framework:** SwiftUI (nativ, leanest, nur Mac) vs. **Tauri v2** (Web-Frontend +
  Rust, Mac **&** Windows, nutzt Chris' vorhandenen React/Vite/Tailwind-Stack) vs. Python+GUI.
  → Empfehlung in `RESEARCH.md`.
- **E2 — Engine bündeln:** `gs` statisch kompilieren vs. mitliefern; pikepdf-Fallback ja/nein.
- **E3 — Name/Branding** der ausgelieferten App.
