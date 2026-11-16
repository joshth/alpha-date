export type DashboardSortKey = "term" | "aura" | "confidence"
export type SortDirection = "ascending" | "descending"
export type AuraSortPref = { key: DashboardSortKey; direction: SortDirection }

export const AURA_SORT_STORAGE_KEY = "lab-aura-sort"
export const DEFAULT_AURA_SORT: AuraSortPref = { key: "term", direction: "ascending" }

const KEYS: readonly string[] = ["term", "aura", "confidence"]
const DIRECTIONS: readonly string[] = ["ascending", "descending"]

export function parseAuraSortPref(raw: unknown): AuraSortPref {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : null
    if (value && typeof value === "object") {
      const { key, direction } = value as Record<string, unknown>
      if (typeof key === "string" && KEYS.includes(key) && typeof direction === "string" && DIRECTIONS.includes(direction))
        return { key: key as DashboardSortKey, direction: direction as SortDirection }
    }
  } catch {
    // Not JSON: treated like a missing value.
  }
  return DEFAULT_AURA_SORT
}

export function readAuraSortPref(storage: Pick<Storage, "getItem"> | null): AuraSortPref {
  try {
    return parseAuraSortPref(storage?.getItem(AURA_SORT_STORAGE_KEY))
  } catch {
    return DEFAULT_AURA_SORT // storage blocked (private window, site data off)
  }
}

export function writeAuraSortPref(storage: Pick<Storage, "setItem"> | null, pref: AuraSortPref): void {
  try {
    storage?.setItem(AURA_SORT_STORAGE_KEY, JSON.stringify(pref))
  } catch {
    // The sort just won't be remembered.
  }
}

/** Reading window.localStorage itself can throw when site data is blocked. */
export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
