import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getVersion } from "@tauri-apps/api/app";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { translations, detectLang, saveLang, LANGS, type Lang } from "./i18n";
import {
  detectThemePref,
  saveThemePref,
  applyTheme,
  THEME_CYCLE,
  type ThemePref,
} from "./theme";
import "./App.css";

type CompressResult = {
  input: string;
  output: string | null;
  before: number;
  after: number;
  saved_pct: number;
  dpi: number;
};

type Row = {
  path: string;
  name: string;
  status: "queued" | "running" | "done" | "error" | "nogain";
  result?: CompressResult;
  error?: string;
};

const THEME_ICON: Record<ThemePref, string> = { system: "🖥", light: "☀", dark: "🌙" };

function fmtSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function App() {
  const [lang, setLang] = useState<Lang>(detectLang());
  const [theme, setTheme] = useState<ThemePref>(detectThemePref());
  const [percent, setPercent] = useState(() => Number(localStorage.getItem("cdbpdf.percent")) || 80);
  const [inplace, setInplace] = useState(() => localStorage.getItem("cdbpdf.inplace") === "1");
  const [grayscale, setGrayscale] = useState(() => localStorage.getItem("cdbpdf.grayscale") === "1");
  const [rows, setRows] = useState<Row[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [gsOk, setGsOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [update, setUpdate] = useState<Update | null>(null);
  const [updating, setUpdating] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  const t = translations[lang];

  const presets = [
    { percent: 20, label: t.presetScreen, hint: t.hintScreen },
    { percent: 50, label: t.presetEbook, hint: t.hintEbook },
    { percent: 90, label: t.presetPrinter, hint: t.hintPrinter },
  ];

  useEffect(() => {
    invoke<string>("check_ghostscript")
      .then(() => setGsOk(true))
      .catch(() => setGsOk(false));

    getVersion().then(setAppVersion).catch(() => {});

    check()
      .then((u) => {
        if (u) setUpdate(u);
      })
      .catch(() => {
        /* offline / no manifest — ignore */
      });

    const unlisten = getCurrentWebviewWindow().onDragDropEvent((event) => {
      const p = event.payload;
      if (p.type === "over" || p.type === "enter") setDragOver(true);
      else if (p.type === "leave") setDragOver(false);
      else if (p.type === "drop") {
        setDragOver(false);
        addPaths(p.paths);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    saveLang(lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("cdbpdf.percent", String(percent));
    localStorage.setItem("cdbpdf.inplace", inplace ? "1" : "0");
    localStorage.setItem("cdbpdf.grayscale", grayscale ? "1" : "0");
  }, [percent, inplace, grayscale]);

  useEffect(() => {
    saveThemePref(theme);
    applyTheme(theme);
    if (theme !== "system") return;
    // keep following the OS while on "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  async function installUpdate() {
    if (!update || updating) return;
    setUpdating(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      setUpdating(false);
    }
  }

  function cycleTheme() {
    const i = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(i + 1) % THEME_CYCLE.length]);
  }

  function themeLabel(p: ThemePref): string {
    return p === "system" ? t.themeSystem : p === "light" ? t.themeLight : t.themeDark;
  }

  function addPaths(paths: string[]) {
    const pdfs = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) return;
    setRows((prev) => {
      const next = [...prev];
      for (const p of pdfs) {
        const idx = next.findIndex((r) => r.path === p);
        const row: Row = { path: p, name: basename(p), status: "queued" };
        // re-dropping/re-picking an already-listed file re-queues it (recompress)
        if (idx >= 0) next[idx] = row;
        else next.push(row);
      }
      return next;
    });
  }

  function removeRow(path: string) {
    setRows((prev) => prev.filter((r) => r.path !== path));
  }

  async function pickFiles() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!selected) return;
    addPaths(Array.isArray(selected) ? selected : [selected]);
  }

  async function compressAll() {
    setBusy(true);
    const targets = rows.filter((r) => r.status === "queued" || r.status === "error");
    for (const target of targets) {
      setRows((prev) =>
        prev.map((r) => (r.path === target.path ? { ...r, status: "running", error: undefined } : r))
      );
      try {
        const result = await invoke<CompressResult>("compress_pdf", {
          path: target.path,
          qualityPercent: percent,
          inplace,
          grayscale,
        });
        setRows((prev) =>
          prev.map((r) =>
            r.path === target.path
              ? { ...r, status: result.output ? "done" : "nogain", result }
              : r
          )
        );
      } catch (e) {
        setRows((prev) =>
          prev.map((r) =>
            r.path === target.path ? { ...r, status: "error", error: String(e) } : r
          )
        );
      }
    }
    setBusy(false);
  }

  const queuedCount = rows.filter((r) => r.status === "queued" || r.status === "error").length;
  const totalBefore = rows.reduce((s, r) => s + (r.result?.before ?? 0), 0);
  const totalAfter = rows.reduce((s, r) => s + (r.result?.after ?? 0), 0);
  const totalSaved = totalBefore > 0 ? (1 - totalAfter / totalBefore) * 100 : 0;
  const dpi = Math.round(72 + (300 - 72) * percent / 100);

  return (
    <main className="app">
      {update && (
        <div className="update-banner">
          <span>
            {t.updateAvailable} <strong>v{update.version}</strong>
          </span>
          <button className="update-dl" onClick={installUpdate} disabled={updating}>
            {updating ? (
              <>
                <span className="spin" /> {t.updateInstalling}
              </>
            ) : (
              t.updateInstall
            )}
          </button>
          {!updating && (
            <button className="update-x" onClick={() => setUpdate(null)} aria-label="×">
              ×
            </button>
          )}
        </div>
      )}

      <header className="head">
        <h1>CDB PDF Compressor</h1>
        <div className="head-controls">
          <div className="lang" role="group">
            {LANGS.map((l) => (
              <button
                key={l}
                className={lang === l ? "active" : ""}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="theme"
            onClick={cycleTheme}
            title={themeLabel(theme)}
            aria-label={themeLabel(theme)}
          >
            {THEME_ICON[theme]}
          </button>
        </div>
      </header>

      <div className="statusline">
        <span className={`gs ${gsOk === false ? "bad" : ""}`}>
          {gsOk === null ? "…" : gsOk ? t.gsReady : t.gsMissing}
        </span>
      </div>

      <section className={`drop ${dragOver ? "over" : ""}`}>
        <p className="drop-title">{t.dropTitle}</p>
        <p className="drop-hint">{t.dropHint}</p>
        <button className="ghost pick" onClick={pickFiles} disabled={busy}>
          {t.pick}
        </button>
      </section>

      <section className={`controls ${busy ? "locked" : ""}`}>
        <div className="slider">
          <label>
            {t.quality} <strong>{percent}%</strong> <span className="muted">≈ {dpi} dpi</span>
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={percent}
            disabled={busy}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
          <div className="presets">
            {presets.map((p) => (
              <button
                key={p.label}
                className={percent === p.percent ? "active" : ""}
                disabled={busy}
                onClick={() => setPercent(p.percent)}
                title={p.hint}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="inplace">
          <input
            type="checkbox"
            checked={inplace}
            disabled={busy}
            onChange={(e) => setInplace(e.target.checked)}
          />
          {t.inplace}
          <span className="muted"> {t.inplaceHint}</span>
        </label>
        <label className="inplace">
          <input
            type="checkbox"
            checked={grayscale}
            disabled={busy}
            onChange={(e) => setGrayscale(e.target.checked)}
          />
          {t.grayscale}
        </label>
      </section>

      <section className="actions">
        <button className="primary" disabled={busy || queuedCount === 0} onClick={compressAll}>
          {busy ? (
            <>
              <span className="spin" /> {t.compressing}
            </>
          ) : (
            `${t.compress}${queuedCount ? ` (${queuedCount})` : ""}`
          )}
        </button>
        {rows.length > 0 && (
          <button className="ghost" disabled={busy} onClick={() => setRows([])}>
            {t.clear}
          </button>
        )}
      </section>

      {rows.length > 0 && (
        <table className="results">
          <thead>
            <tr>
              <th>{t.colFile}</th>
              <th>{t.colBefore}</th>
              <th>{t.colAfter}</th>
              <th>{t.colSavings}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path} className={r.status}>
                <td className="file" title={r.path}>{r.name}</td>
                <td>{r.result ? fmtSize(r.result.before) : "–"}</td>
                <td>
                  {r.status === "running"
                    ? <span className="spin" />
                    : r.status === "error"
                    ? t.statusError
                    : r.status === "nogain"
                    ? t.statusNogain
                    : r.result
                    ? fmtSize(r.result.after)
                    : "–"}
                </td>
                <td>{r.status === "done" && r.result ? `−${r.result.saved_pct.toFixed(0)}%` : "–"}</td>
                <td>
                  {r.status === "done" && r.result?.output && (
                    <span className="row-actions">
                      <button className="link" onClick={() => openPath(r.result!.output!)}>
                        {t.openFile}
                      </button>
                      <button className="link" onClick={() => revealItemInDir(r.result!.output!)}>
                        {t.reveal}
                      </button>
                    </span>
                  )}
                  {r.status === "error" && <span className="err" title={r.error}>!</span>}
                  {!busy && (
                    <button className="row-x" onClick={() => removeRow(r.path)} aria-label="×" title="Entfernen">
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {totalBefore > 0 && (
            <tfoot>
              <tr>
                <td>{t.total}</td>
                <td>{fmtSize(totalBefore)}</td>
                <td>{fmtSize(totalAfter)}</td>
                <td>−{totalSaved.toFixed(0)}%</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {appVersion && <footer className="version">v{appVersion}</footer>}
    </main>
  );
}

export default App;
