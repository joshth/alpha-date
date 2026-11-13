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
  throw new Error("scoreTermLifecycle: stage rule not implemented yet")
}

export const AURA_STAGE_LABELS: Record<AuraStage, string> = {
  emerging: "Emerging",
  peaking: "Peaking",
  declining: "Declining",
  parent_territory: "Parent territory",
}
