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

export function scoreTermLifecycle(_events: TermEvent[], _now: Date = new Date()): AuraScore | null {
  throw new Error("scoreTermLifecycle: not implemented yet (Sprint 3)")
}

export const AURA_STAGE_LABELS: Record<AuraStage, string> = {
  emerging: "Emerging",
  peaking: "Peaking",
  declining: "Declining",
  parent_territory: "Parent territory",
}
