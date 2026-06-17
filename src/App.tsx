import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
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

const PRESETS = [
  { label: "Screen", percent: 20, hint: "Feed/Web · kleinste" },
  { label: "Ebook", percent: 50, hint: "Standard · scharf" },
  { label: "Printer", percent: 90, hint: "Druck · höchste Treue" },
];

function fmtSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function App() {
  const [percent, setPercent] = useState(80);
  const [inplace, setInplace] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [gsOk, setGsOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    invoke<string>("check_ghostscript")
      .then(() => setGsOk(true))
      .catch(() => setGsOk(false));

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
    // snapshot of queued/error rows to process
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

  return (
    <main className="app">
      <header className="head">
        <h1>CDB PDF Compressor</h1>
        <span className={`gs ${gsOk === false ? "bad" : ""}`}>
          {gsOk === null ? "…" : gsOk ? "Ghostscript bereit" : "Ghostscript fehlt"}
        </span>
      </header>

      <section className={`drop ${dragOver ? "over" : ""}`}>
        <p className="drop-title">PDF(s) hierher ziehen</p>
        <p className="drop-hint">vom Finder/Desktop · auch mehrere auf einmal</p>
        <button className="ghost pick" onClick={pickFiles} disabled={busy}>
          Dateien wählen…
        </button>
      </section>

      <section className={`controls ${busy ? "locked" : ""}`}>
        <div className="slider">
          <label>
            Qualität <strong>{percent}%</strong> <span className="muted">≈ {Math.round(72 + (300 - 72) * percent / 100)} dpi</span>
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
            {PRESETS.map((p) => (
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
          Original ersetzen
          <span className="muted"> (sonst Kopie daneben)</span>
        </label>
      </section>

      <section className="actions">
        <button className="primary" disabled={busy || queuedCount === 0} onClick={compressAll}>
          {busy ? (
            <>
              <span className="spin" /> Komprimiere…
            </>
          ) : (
            `Komprimieren${queuedCount ? ` (${queuedCount})` : ""}`
          )}
        </button>
        {rows.length > 0 && (
          <button className="ghost" disabled={busy} onClick={() => setRows([])}>
            Liste leeren
          </button>
        )}
      </section>

      {rows.length > 0 && (
        <table className="results">
          <thead>
            <tr>
              <th>Datei</th>
              <th>Vorher</th>
              <th>Nachher</th>
              <th>Ersparnis</th>
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
                    ? "Fehler"
                    : r.status === "nogain"
                    ? "kein Gewinn"
                    : r.result
                    ? fmtSize(r.result.after)
                    : "–"}
                </td>
                <td>{r.status === "done" && r.result ? `−${r.result.saved_pct.toFixed(0)}%` : "–"}</td>
                <td>
                  {r.status === "done" && r.result?.output && (
                    <button className="link" onClick={() => revealItemInDir(r.result!.output!)}>
                      Im Finder zeigen
                    </button>
                  )}
                  {r.status === "error" && <span className="err" title={r.error}>!</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {totalBefore > 0 && (
            <tfoot>
              <tr>
                <td>Gesamt</td>
                <td>{fmtSize(totalBefore)}</td>
                <td>{fmtSize(totalAfter)}</td>
                <td>−{totalSaved.toFixed(0)}%</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </main>
  );
}

export default App;
