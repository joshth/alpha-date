// INTEGRATION CONTRACT — "Aura" lifecycle scoring (Sprint 3, team-owned).
// Pure function: takes events, returns a stage. No database access.
//
// Input is anonymous search events only (term + type + timestamp). The seeded
// database has ~6 months of synthetic history per seed-lexicon term with known
// generator shapes (lib/_stubs/fixtures/synthetic.ts → SYNTHETIC_SHAPES) to
// test against. Document your rules and thresholds; production will run them on
// real (also anonymous) event data, so avoid tuning to the generator.

export type AuraStage = "emerging" | "peaking" | "declining" | "parent_territory"

export interface TermEvent {
  eventType: string
  createdAt: Date
}

export interface AuraScore {
  stage: AuraStage
  /** 0-1 confidence; low when there is too little data. */
  confidence: number
  /** Plain-English explanation shown to reviewers (not to the public). */
  explanation: string
}

/** Fewer counted events than this in the window gives no stage at all. */
export const MIN_EVENTS = 30
export const WINDOW_DAYS = 180
/** Share of its peak (r) at or above which a term counts as peaking. Tuned on the train split of the SIRS fixtures; the noise-free SIRS rule uses 0.8, but a 180-day window cannot see a peak that came before it. */
export const R_PEAK = 0.9
/** Smallest first-to-last change, as a share of peak, that counts as real movement. Tuned on the train split of the SIRS fixtures; the noise-free SIRS rule uses 0.2 (see R_PEAK). */
export const FLOOR = 0.15
/** Days averaged at each end of the window for the first and last levels. */
export const BLOCK_DAYS = 60
/** Rolling-mean width in days used to find the peak. */
export const PEAK_SMOOTH_DAYS = 30
/** A term still rising but already this close to its peak counts as peaking. */
export const R_RISING_PEAK = 0.95
const DAY_MS = 86_400_000
/** Model and prompt events are made by the app, not by people searching. */
const IGNORED_TYPES = new Set(["llm_generated", "prompt_generated"])

/** Counted events per day across the window; index 0 is the oldest day, the last index ends at `now`. */
export function dailyCounts(events: TermEvent[], now: Date): number[] {
  const days = new Array<number>(WINDOW_DAYS).fill(0)
  for (const event of events) {
    if (IGNORED_TYPES.has(event.eventType)) continue
    const daysAgo = Math.floor((now.getTime() - event.createdAt.getTime()) / DAY_MS)
    if (daysAgo >= 0 && daysAgo < WINDOW_DAYS) days[WINDOW_DAYS - 1 - daysAgo]++
  }
  return days
}

export function scoreTermLifecycle(events: TermEvent[], now: Date = new Date()): AuraScore | null {
  const days = dailyCounts(events, now)
  if (days.reduce((a, b) => a + b, 0) < MIN_EVENTS) return null
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const first = mean(days.slice(0, BLOCK_DAYS))
  const last = mean(days.slice(-BLOCK_DAYS))
  let peak = 0
  for (let i = 0; i + PEAK_SMOOTH_DAYS <= days.length; i++) peak = Math.max(peak, mean(days.slice(i, i + PEAK_SMOOTH_DAYS)))
  const r = last / peak
  const delta = (last - first) / peak
  let stage: AuraStage
  if (delta >= FLOOR) stage = r >= R_RISING_PEAK ? "peaking" : "emerging"
  else if (r >= R_PEAK) stage = "peaking"
  else if (Math.abs(delta) < FLOOR) stage = "parent_territory"
  else stage = "declining"
  return { stage, confidence: 1, explanation: "" }
}

export const AURA_STAGE_LABELS: Record<AuraStage, string> = {
  emerging: "Emerging",
  peaking: "Peaking",
  declining: "Declining",
  parent_territory: "Parent territory",
}
