#!/usr/bin/env python
"""compress-pdf — shrink PDFs (image-heavy decks, reports) via Ghostscript.

Usage:
  python skills/pdf-compress/tools/compress.py <pdf-or-dir> [more...] \
      [--quality-percent 1..100] [--quality screen|ebook|printer] [--dpi N] [--inplace]

Quality:
  --quality-percent N   PRIMARY knob. Higher % = higher quality + larger file.
                        100 ≈ 300 dpi (kaum komprimiert), 50 ≈ 186 dpi, 20 ≈ 117 dpi.
                        Default 80 (≈ 254 dpi) — crisp, deutlich besser als das alte ebook.
  --quality PRESET      Named shortcuts: screen(~72) | ebook(~150) | printer(~300).
  --dpi N               Explicit image resolution override (power users).

- Without --inplace, writes <name>.compressed.pdf next to the original.
- Recurses into directories. Skips *.compressed.pdf. If no size gain (non-inplace), keeps original.
- Needs Ghostscript:  brew install ghostscript
"""
import argparse, shutil, subprocess, sys
from pathlib import Path

PRESETS = {"screen": "/screen", "ebook": "/ebook", "printer": "/printer"}
DPI_MIN, DPI_MAX = 72, 300  # quality-percent maps linearly into this dpi range

def gs_bin():
    return shutil.which("gs")

def pct_to_dpi(pct: int) -> int:
    return round(DPI_MIN + (DPI_MAX - DPI_MIN) * max(1, min(100, pct)) / 100)

def build_cmd(src: Path, tmp: Path, quality, percent, dpi):
    base = ["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", "-dNOPAUSE", "-dBATCH",
            "-dQUIET", "-dDetectDuplicateImages=true", "-dCompressFonts=true"]
    if percent is not None or dpi is not None:
        res = dpi if dpi is not None else pct_to_dpi(percent)
        tune = ["-dPDFSETTINGS=/printer",  # high-quality JPEG base; we override resolution
                "-dDownsampleColorImages=true", f"-dColorImageResolution={res}", "-dColorImageDownsampleType=/Bicubic",
                "-dDownsampleGrayImages=true", f"-dGrayImageResolution={res}", "-dGrayImageDownsampleType=/Bicubic",
                "-dDownsampleMonoImages=true", f"-dMonoImageResolution={max(res, 300)}"]
        label = f"{res}dpi" + (f" ({percent}%)" if percent is not None and dpi is None else "")
    else:
        tune = [f"-dPDFSETTINGS={PRESETS[quality]}"]
        label = quality
    return [gs_bin(), *base, *tune, f"-sOutputFile={tmp}", str(src)], label

def compress(src: Path, quality, percent, dpi, inplace: bool):
    dst = src if inplace else src.with_suffix(".compressed.pdf")
    tmp = src.with_suffix(".gscompress.tmp.pdf")
    cmd, label = build_cmd(src, tmp, quality, percent, dpi)
    subprocess.run(cmd, check=True)
    before, after = src.stat().st_size, tmp.stat().st_size
    if after >= before and not inplace:
        tmp.unlink(missing_ok=True)
        return before, before, None, label
    tmp.replace(dst)
    return before, after, dst, label

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--quality-percent", type=int, default=None, dest="percent")
    ap.add_argument("--quality", default=None, choices=list(PRESETS))
    ap.add_argument("--dpi", type=int, default=None)
    ap.add_argument("--inplace", action="store_true")
    args = ap.parse_args()

    if not gs_bin():
        sys.exit("Ghostscript (gs) fehlt. Installieren:  brew install ghostscript")
    # default to a high-quality percent when nothing chosen
    if args.percent is None and args.quality is None and args.dpi is None:
        args.percent = 80

    pdfs = []
    for p in (Path(x) for x in args.paths):
        pdfs.extend(sorted(p.rglob("*.pdf")) if p.is_dir() else [p])

    total_b = total_a = 0
    for pdf in pdfs:
        if pdf.suffix != ".pdf" or pdf.stem.endswith(".compressed"):
            continue
        b, a, dst, label = compress(pdf, args.quality, args.percent, args.dpi, args.inplace)
        total_b += b; total_a += a
        pct = (1 - a / b) * 100 if b else 0
        where = "(kein Gewinn, übersprungen)" if dst is None else f"-> {dst.name}"
        print(f"{pdf.name} [{label}]: {b/1e6:.1f}MB -> {a/1e6:.1f}MB  (-{pct:.0f}%) {where}")
    if total_b:
        print(f"\nGesamt: {total_b/1e6:.1f}MB -> {total_a/1e6:.1f}MB  (-{(1-total_a/total_b)*100:.0f}%)")

if __name__ == "__main__":
    main()
