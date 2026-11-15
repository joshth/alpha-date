export type ThemePref = "light" | "dark" | "system"

export const THEME_STORAGE_KEY = "lab-theme"

export function parseThemePref(raw: unknown): ThemePref {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system"
}

/** An explicit choice wins; "system" follows the operating system. */
export function resolveTheme(pref: ThemePref, osPrefersLight: boolean): "light" | "dark" {
  return pref === "system" ? (osPrefersLight ? "light" : "dark") : pref
}

export function readThemePref(storage: Pick<Storage, "getItem"> | null): ThemePref {
  try {
    return parseThemePref(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return "system" // storage blocked (private window, site data off)
  }
}

export function writeThemePref(storage: Pick<Storage, "setItem"> | null, pref: ThemePref): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // The choice just won't be remembered.
  }
}

/**
 * Applies a choice to <html>: light or dark sets data-theme, system removes it so the CSS follows the OS.
 * data-resolved-theme always carries the theme actually in effect.
 */
export function applyThemePref(
  el: Pick<Element, "setAttribute" | "removeAttribute">,
  pref: ThemePref,
  osPrefersLight: boolean,
): void {
  if (pref === "system") el.removeAttribute("data-theme")
  else el.setAttribute("data-theme", pref)
  el.setAttribute("data-resolved-theme", resolveTheme(pref, osPrefersLight))
}

/**
 * Runs before first paint (inlined by app/lab/layout.tsx) so the right theme shows with no flash.
 * Explicit light or dark sets data-theme; "system" removes it so the CSS follows the OS.
 * data-resolved-theme always carries the theme actually in effect, for scripts that need it (e.g. image export).
 */
export function themeInitScript(): string {
  return '(function(){var e=document.documentElement,p;try{p=localStorage.getItem("lab-theme")}catch(_){}var x=p==="light"||p==="dark";x?e.setAttribute("data-theme",p):e.removeAttribute("data-theme");e.setAttribute("data-resolved-theme",x?p:matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")})()'
}
