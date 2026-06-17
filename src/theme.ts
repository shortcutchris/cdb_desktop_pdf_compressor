// Theme preference: "system" follows macOS, "light"/"dark" force a mode.
// Resolved mode is written to <html data-theme="…"> for the CSS to react to.

export type ThemePref = "system" | "light" | "dark";

export const THEME_CYCLE: ThemePref[] = ["system", "light", "dark"];

const THEME_KEY = "cdbpdf.theme";

export function detectThemePref(): ThemePref {
  const saved = localStorage.getItem(THEME_KEY) as ThemePref | null;
  if (saved === "system" || saved === "light" || saved === "dark") return saved;
  return "system";
}

export function saveThemePref(pref: ThemePref) {
  localStorage.setItem(THEME_KEY, pref);
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Apply the preference to the document; returns the resolved "light"/"dark". */
export function applyTheme(pref: ThemePref): "light" | "dark" {
  const resolved = pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
  document.documentElement.dataset.theme = resolved;
  return resolved;
}
