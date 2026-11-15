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
