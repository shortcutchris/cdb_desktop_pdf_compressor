// Minimal, dependency-free i18n for this single-window app.
// Add a language by adding another entry to `translations` with the same keys.

export type Lang = "de" | "en";

export const LANGS: Lang[] = ["de", "en"];

export type Strings = {
  gsReady: string;
  gsMissing: string;
  dropTitle: string;
  dropHint: string;
  pick: string;
  quality: string;
  presetScreen: string;
  presetEbook: string;
  presetPrinter: string;
  hintScreen: string;
  hintEbook: string;
  hintPrinter: string;
  inplace: string;
  inplaceHint: string;
  compress: string;
  compressing: string;
  clear: string;
  colFile: string;
  colBefore: string;
  colAfter: string;
  colSavings: string;
  total: string;
  reveal: string;
  statusError: string;
  statusNogain: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
};

export const translations: Record<Lang, Strings> = {
  de: {
    gsReady: "Ghostscript bereit",
    gsMissing: "Ghostscript fehlt",
    dropTitle: "PDF(s) hierher ziehen",
    dropHint: "vom Finder/Desktop · auch mehrere auf einmal",
    pick: "Dateien wählen…",
    quality: "Qualität",
    presetScreen: "Screen",
    presetEbook: "Ebook",
    presetPrinter: "Printer",
    hintScreen: "Feed/Web · kleinste",
    hintEbook: "Standard · scharf",
    hintPrinter: "Druck · höchste Treue",
    inplace: "Original ersetzen",
    inplaceHint: "(sonst Kopie daneben)",
    compress: "Komprimieren",
    compressing: "Komprimiere…",
    clear: "Liste leeren",
    colFile: "Datei",
    colBefore: "Vorher",
    colAfter: "Nachher",
    colSavings: "Ersparnis",
    total: "Gesamt",
    reveal: "Im Finder zeigen",
    statusError: "Fehler",
    statusNogain: "kein Gewinn",
    themeSystem: "System",
    themeLight: "Hell",
    themeDark: "Dunkel",
  },
  en: {
    gsReady: "Ghostscript ready",
    gsMissing: "Ghostscript missing",
    dropTitle: "Drop PDF(s) here",
    dropHint: "from Finder/Desktop · multiple at once",
    pick: "Choose files…",
    quality: "Quality",
    presetScreen: "Screen",
    presetEbook: "Ebook",
    presetPrinter: "Printer",
    hintScreen: "Feed/web · smallest",
    hintEbook: "Default · crisp",
    hintPrinter: "Print · highest fidelity",
    inplace: "Replace original",
    inplaceHint: "(otherwise a copy alongside)",
    compress: "Compress",
    compressing: "Compressing…",
    clear: "Clear list",
    colFile: "File",
    colBefore: "Before",
    colAfter: "After",
    colSavings: "Savings",
    total: "Total",
    reveal: "Show in Finder",
    statusError: "Error",
    statusNogain: "no gain",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
  },
};

const LANG_KEY = "cdbpdf.lang";

export function detectLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY) as Lang | null;
  if (saved && LANGS.includes(saved)) return saved;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export function saveLang(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang);
}
