export const ACCESSIBILITY_STORAGE_KEY = "alpha-date-accessibility-v1"

export type AccessibilityPreset = "Custom" | "Vision" | "Motor" | "Reading"
export type AccessibilityFont = "system" | "atkinson" | "opendyslexic"
export type LineSpacing = "normal" | "relaxed" | "wide"
export type TextSize = 100 | 125 | 150 | 200

export type AccessibilityPreferences = {
  preset: AccessibilityPreset
  font: AccessibilityFont
  textSize: TextSize
  lineSpacing: LineSpacing
  calmMotion: boolean | null
  highContrast: boolean | null
  largeControls: boolean
}

export type SystemPreferences = {
  reducedMotion: boolean
  highContrast: boolean
  darkTheme: boolean
}

export type ResolvedPreferences = Omit<AccessibilityPreferences, "calmMotion" | "highContrast"> & {
  calmMotion: boolean
  highContrast: boolean
  darkTheme: boolean
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  preset: "Custom",
  font: "system",
  textSize: 100,
  lineSpacing: "normal",
  calmMotion: null,
  highContrast: null,
  largeControls: false,
}

export function accessibilityInitScript(): string {
  return `(function(){var d=document.documentElement,b=document.body,p={};try{var raw=localStorage.getItem("${ACCESSIBILITY_STORAGE_KEY}");if(raw)p=JSON.parse(raw)||{}}catch(_){}var calm=typeof p.calmMotion==="boolean"?p.calmMotion:matchMedia("(prefers-reduced-motion: reduce)").matches;var contrast=typeof p.highContrast==="boolean"?p.highContrast:matchMedia("(prefers-contrast: more)").matches;d.setAttribute("data-high-contrast",String(contrast));d.setAttribute("data-text-size",String([100,125,150,200].includes(p.textSize)?p.textSize:100));b.setAttribute("data-accessibility-font",["system","atkinson","opendyslexic"].includes(p.font)?p.font:"system");b.setAttribute("data-line-spacing",["normal","relaxed","wide"].includes(p.lineSpacing)?p.lineSpacing:"normal");b.setAttribute("data-calm-motion",String(calm));b.setAttribute("data-large-controls",String(Boolean(p.largeControls)))})()`
}

const PRESETS: Record<Exclude<AccessibilityPreset, "Custom">, Omit<AccessibilityPreferences, "preset">> = {
  Vision: { font: "system", textSize: 125, lineSpacing: "normal", calmMotion: null, highContrast: true, largeControls: false },
  Motor: { font: "system", textSize: 100, lineSpacing: "normal", calmMotion: true, highContrast: null, largeControls: true },
  Reading: { font: "opendyslexic", textSize: 100, lineSpacing: "wide", calmMotion: null, highContrast: null, largeControls: false },
}

export function applyPreset(preset: Exclude<AccessibilityPreset, "Custom">): AccessibilityPreferences {
  return { ...PRESETS[preset], preset }
}

export function updatePreference<K extends keyof Omit<AccessibilityPreferences, "preset">>(
  preferences: AccessibilityPreferences,
  key: K,
  value: AccessibilityPreferences[K],
): AccessibilityPreferences {
  return { ...preferences, [key]: value, preset: "Custom" }
}

export function resolvePreferences(
  preferences: AccessibilityPreferences,
  system: SystemPreferences,
): ResolvedPreferences {
  return {
    ...preferences,
    calmMotion: preferences.calmMotion ?? system.reducedMotion,
    highContrast: preferences.highContrast ?? system.highContrast,
    darkTheme: system.darkTheme,
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function loadPreferences(storage: StorageLike): AccessibilityPreferences {
  try {
    const raw = storage.getItem(ACCESSIBILITY_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_ACCESSIBILITY_PREFERENCES }
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return { ...DEFAULT_ACCESSIBILITY_PREFERENCES }
    const saved = value as Partial<AccessibilityPreferences>
    const merged = { ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...saved }
    return isValidPreferences(merged) ? merged : { ...DEFAULT_ACCESSIBILITY_PREFERENCES }
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES }
  }
}

export function savePreferences(storage: StorageLike, preferences: AccessibilityPreferences): boolean {
  try {
    storage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences))
    return true
  } catch {
    return false
  }
}

export function clearPreferences(storage: StorageLike): boolean {
  try {
    storage.removeItem(ACCESSIBILITY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function shouldToggleHighContrast(event: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  target?: { tagName?: string; isContentEditable?: boolean } | null
}): boolean {
  if (event.key.toLowerCase() !== "h" || !event.shiftKey || event.altKey) return false
  if (!event.ctrlKey && !event.metaKey) return false
  const target = event.target
  if (target?.isContentEditable) return false
  return !(target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? ""))
}

function isValidPreferences(value: Partial<AccessibilityPreferences>): value is AccessibilityPreferences {
  return ["Custom", "Vision", "Motor", "Reading"].includes(value.preset ?? "")
    && ["system", "atkinson", "opendyslexic"].includes(value.font ?? "")
    && [100, 125, 150, 200].includes(value.textSize ?? -1)
    && ["normal", "relaxed", "wide"].includes(value.lineSpacing ?? "")
    && (value.calmMotion === null || typeof value.calmMotion === "boolean")
    && (value.highContrast === null || typeof value.highContrast === "boolean")
    && typeof value.largeControls === "boolean"
}
