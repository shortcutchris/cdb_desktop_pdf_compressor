// CDB PDF Compressor — Ghostscript engine bridge.
// Compression logic ported 1:1 from the pdf-compress skill (reference-skill/tools/compress.py):
// quality-percent -> dpi mapping, gs flags, and the "no size gain -> keep original" guard.

use std::path::{Path, PathBuf};
use std::process::Command;

const DPI_MIN: u32 = 72;
const DPI_MAX: u32 = 300;

// Platform-specific bits of the bundled Ghostscript.
#[cfg(target_os = "windows")]
const GS_BUNDLED_BIN: &str = "gs/bin/gswin64c.exe";
#[cfg(not(target_os = "windows"))]
const GS_BUNDLED_BIN: &str = "gs/bin/gs";

#[cfg(target_os = "windows")]
const GS_LIB_SEP: &str = ";"; // Ghostscript GS_LIB path separator on Windows
#[cfg(not(target_os = "windows"))]
const GS_LIB_SEP: &str = ":";

/// Prevent a console window from flashing when spawning gs on Windows.
#[cfg(target_os = "windows")]
fn hide_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}
#[cfg(not(target_os = "windows"))]
fn hide_console(_cmd: &mut Command) {}

/// Map a 1..100 quality percentage to an image resolution in dpi (linear over 72..300).
fn pct_to_dpi(pct: u32) -> u32 {
    let pct = pct.clamp(1, 100);
    (DPI_MIN as f64 + (DPI_MAX - DPI_MIN) as f64 * pct as f64 / 100.0).round() as u32
}

/// A resolved Ghostscript engine: the binary plus, for the bundled (relocated) gs,
/// the env/args needed to find its Resource/font/ICC files.
struct GsEngine {
    bin: PathBuf,
    gs_lib: Option<String>,  // value for the GS_LIB env var (bundled only)
    icc_dir: Option<String>, // value for -sICCProfilesDir (bundled only)
}

/// Locate a system Ghostscript (dev / when no bundled gs is present).
#[cfg(not(target_os = "windows"))]
fn find_system_gs() -> Option<PathBuf> {
    // GUI apps on macOS don't inherit the shell PATH, so probe common locations too.
    let candidates = [
        "/opt/homebrew/bin/gs", // Apple Silicon Homebrew
        "/usr/local/bin/gs",    // Intel Homebrew
        "/usr/bin/gs",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return Some(PathBuf::from(c));
        }
    }
    if Command::new("gs").arg("--version").output().is_ok() {
        return Some(PathBuf::from("gs"));
    }
    None
}

#[cfg(target_os = "windows")]
fn find_system_gs() -> Option<PathBuf> {
    // Rely on PATH (a system Ghostscript install adds gswin64c to PATH).
    let mut probe = Command::new("gswin64c");
    probe.arg("--version");
    hide_console(&mut probe);
    if probe.output().is_ok() {
        return Some(PathBuf::from("gswin64c"));
    }
    None
}

/// Resolve the engine to use: prefer the gs bundled into the app's resources
/// (self-contained, no Homebrew needed); fall back to a system gs (dev / unbundled).
fn resolve_gs(app: &tauri::AppHandle) -> Option<GsEngine> {
    use tauri::Manager;
    if let Ok(res) = app.path().resource_dir() {
        let bin = res.join(GS_BUNDLED_BIN);
        if bin.exists() {
            let share = res.join("gs/share/ghostscript");
            let gs_lib = [
                share.join("Resource/Init"),
                share.join("lib"),
                share.join("Resource"),
                share.join("fonts"),
            ]
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(GS_LIB_SEP);
            return Some(GsEngine {
                bin,
                gs_lib: Some(gs_lib),
                icc_dir: Some(format!("{}/", share.join("iccprofiles").to_string_lossy())),
            });
        }
    }
    find_system_gs().map(|bin| GsEngine {
        bin,
        gs_lib: None,
        icc_dir: None,
    })
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

/// Pick a non-colliding output path next to the source, Finder-style:
/// `name.compressed.pdf`, then `name.compressed 2.pdf`, `name.compressed 3.pdf`, …
/// so leaving previous results in the folder never overwrites them.
fn unique_compressed_path(src: &Path) -> PathBuf {
    let parent = src.parent().unwrap_or_else(|| Path::new("."));
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let base = format!("{stem}.compressed");
    let mut candidate = parent.join(format!("{base}.pdf"));
    let mut n = 2;
    while candidate.exists() {
        candidate = parent.join(format!("{base} {n}.pdf"));
        n += 1;
    }
    candidate
}

/// Returns the Ghostscript version string, or an error if gs is not available.
#[tauri::command]
fn check_ghostscript(app: tauri::AppHandle) -> Result<String, String> {
    let engine = resolve_gs(&app).ok_or_else(|| "Ghostscript (gs) nicht gefunden".to_string())?;
    let mut cmd = Command::new(&engine.bin);
    hide_console(&mut cmd);
    if let Some(lib) = &engine.gs_lib {
        cmd.env("GS_LIB", lib);
    }
    let out = cmd
        .arg("--version")
        .output()
        .map_err(|e| format!("gs konnte nicht gestartet werden: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Compress a single PDF. `quality_percent` is the primary knob (1..100, default 80).
/// With `inplace`, the original is overwritten; otherwise a `<name>.compressed.pdf`
/// is written next to it. If the result isn't smaller (and not inplace), the original
/// is left untouched and `output` is None.
/// Async command wrapper: runs the blocking Ghostscript work on a worker thread
/// so the UI/main thread stays responsive (no macOS beachball, instant feedback).
#[tauri::command]
async fn compress_pdf(
    app: tauri::AppHandle,
    path: String,
    quality_percent: u32,
    inplace: bool,
    grayscale: bool,
) -> Result<CompressResult, String> {
    let engine = resolve_gs(&app).ok_or_else(|| {
        "Ghostscript (gs) nicht gefunden. Installieren: brew install ghostscript".to_string()
    })?;
    tauri::async_runtime::spawn_blocking(move || {
        compress_pdf_blocking(&engine, path, quality_percent, inplace, grayscale)
    })
    .await
    .map_err(|e| format!("Worker-Thread-Fehler: {e}"))?
}

fn compress_pdf_blocking(
    engine: &GsEngine,
    path: String,
    quality_percent: u32,
    inplace: bool,
    grayscale: bool,
) -> Result<CompressResult, String> {
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

    let mut cmd = Command::new(&engine.bin);
    hide_console(&mut cmd);
    // Bundled gs needs GS_LIB / ICC dir pointing at its relocated resources;
    // a system gs finds its own (these are None then).
    if let Some(lib) = &engine.gs_lib {
        cmd.env("GS_LIB", lib);
    }
    cmd.args([
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
    ]);
    if let Some(icc) = &engine.icc_dir {
        cmd.arg(format!("-sICCProfilesDir={icc}"));
    }
    if grayscale {
        // Convert all color to grayscale — big extra savings for scans/slides.
        cmd.args([
            "-sColorConversionStrategy=Gray",
            "-dProcessColorModel=/DeviceGray",
            "-dOverrideICC=true",
        ]);
    }
    let status = cmd
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
        unique_compressed_path(&src)
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![check_ghostscript, compress_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
