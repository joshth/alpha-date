import type { AuraFitResult } from "@/lib/aura/fit"
import type { AuraStage } from "@/lib/aura"

export const EXPLANATION = "Down 5% from its peak, no change in the last 180 days."

export function fitResult(confidence = 0.9, stage: AuraStage | null = "peaking"): AuraFitResult {
  const weeks = Array.from({ length: 26 }, (_, i) => new Date(Date.UTC(2026, 4, 10 + i * 7)).toISOString().slice(0, 10))
  const counts = weeks.map((_, i) => i / 25)
  return {
    kind: "fit", source: "synthetic", stageNote: null,
    fit: { term: "Rizz", generation: "gen_alpha", modelVersion: "test", now: "2026-11-01", weeks, counts,
      fitted: { I: counts, S: counts, R: counts, Gamma: counts },
      r: 0.95, delta: 0, stage, confidence, peakWeek: weeks.at(-1)!, windowStart: "2026-05-05" },
  }
}

export const noFit: AuraFitResult = { kind: "no_data", term: "Rizz", suggestions: [] }
