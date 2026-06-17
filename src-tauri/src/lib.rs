// CDB PDF Compressor — Ghostscript engine bridge.
// Compression logic ported 1:1 from the pdf-compress skill (reference-skill/tools/compress.py):
// quality-percent -> dpi mapping, gs flags, and the "no size gain -> keep original" guard.

use std::path::{Path, PathBuf};
use std::process::Command;

const DPI_MIN: u32 = 72;
const DPI_MAX: u32 = 300;

/// Map a 1..100 quality percentage to an image resolution in dpi (linear over 72..300).
fn pct_to_dpi(pct: u32) -> u32 {
    let pct = pct.clamp(1, 100);
    (DPI_MIN as f64 + (DPI_MAX - DPI_MIN) as f64 * pct as f64 / 100.0).round() as u32
}

/// Locate the Ghostscript binary. GUI apps on macOS don't inherit the shell PATH,
/// so we probe the common Homebrew/system locations in addition to PATH.
fn find_gs() -> Option<String> {
    let candidates = [
        "/opt/homebrew/bin/gs", // Apple Silicon Homebrew
        "/usr/local/bin/gs",    // Intel Homebrew
        "/usr/bin/gs",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return Some(c.to_string());
        }
    }
    // Fallback: rely on PATH (works in `tauri dev`, where the shell PATH is inherited).
    if Command::new("gs").arg("--version").output().is_ok() {
        return Some("gs".to_string());
    }
    None
}

#[derive(serde::Serialize)]
pub struct CompressResult {
    input: String,
    output: Option<String>, // None = no size gain, original kept
    before: u64,
    after: u64,
    saved_pct: f64,
    dpi: u32,
}

/// Returns the Ghostscript version string, or an error if gs is not available.
#[tauri::command]
fn check_ghostscript() -> Result<String, String> {
    let gs = find_gs().ok_or_else(|| "Ghostscript (gs) nicht gefunden".to_string())?;
    let out = Command::new(&gs)
        .arg("--version")
        .output()
        .map_err(|e| format!("gs konnte nicht gestartet werden: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Compress a single PDF. `quality_percent` is the primary knob (1..100, default 80).
/// With `inplace`, the original is overwritten; otherwise a `<name>.compressed.pdf`
/// is written next to it. If the result isn't smaller (and not inplace), the original
/// is left untouched and `output` is None.
#[tauri::command]
fn compress_pdf(path: String, quality_percent: u32, inplace: bool) -> Result<CompressResult, String> {
    let gs = find_gs().ok_or_else(|| {
        "Ghostscript (gs) nicht gefunden. Installieren: brew install ghostscript".to_string()
    })?;

    let src = PathBuf::from(&path);
    if src.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) != Some("pdf".into()) {
        return Err(format!("Keine PDF-Datei: {path}"));
    }
    let before = std::fs::metadata(&src)
        .map_err(|e| format!("Datei nicht lesbar: {e}"))?
        .len();

    let res = pct_to_dpi(quality_percent);
    let mono_res = res.max(300);
    let tmp = src.with_extension("gscompress.tmp.pdf");

    let status = Command::new(&gs)
        .args([
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.5",
            "-dNOPAUSE",
            "-dBATCH",
            "-dQUIET",
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            // high-quality JPEG base; resolution is overridden explicitly below
            "-dPDFSETTINGS=/printer",
            "-dDownsampleColorImages=true",
            &format!("-dColorImageResolution={res}"),
            "-dColorImageDownsampleType=/Bicubic",
            "-dDownsampleGrayImages=true",
            &format!("-dGrayImageResolution={res}"),
            "-dGrayImageDownsampleType=/Bicubic",
            "-dDownsampleMonoImages=true",
            &format!("-dMonoImageResolution={mono_res}"),
        ])
        .arg(format!("-sOutputFile={}", tmp.display()))
        .arg(&src)
        .status()
        .map_err(|e| format!("Ghostscript-Aufruf fehlgeschlagen: {e}"))?;

    if !status.success() {
        let _ = std::fs::remove_file(&tmp);
        return Err("Ghostscript brach mit Fehler ab".to_string());
    }

    let after = std::fs::metadata(&tmp)
        .map_err(|e| format!("Ergebnis nicht lesbar: {e}"))?
        .len();

    // No size gain and not in-place: discard, keep original untouched.
    if after >= before && !inplace {
        let _ = std::fs::remove_file(&tmp);
        return Ok(CompressResult {
            input: path,
            output: None,
            before,
            after: before,
            saved_pct: 0.0,
            dpi: res,
        });
    }

    let dst = if inplace {
        src.clone()
    } else {
        src.with_extension("compressed.pdf")
    };
    std::fs::rename(&tmp, &dst).map_err(|e| format!("Konnte Ergebnis nicht speichern: {e}"))?;

    let saved_pct = if before > 0 {
        (1.0 - after as f64 / before as f64) * 100.0
    } else {
        0.0
    };

    Ok(CompressResult {
        input: path,
        output: Some(dst.to_string_lossy().to_string()),
        before,
        after,
        saved_pct,
        dpi: res,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![check_ghostscript, compress_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
