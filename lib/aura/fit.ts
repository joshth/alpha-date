// Fit an Aura term: vendored SIRS data first, else a synthetic fit from our own events.
import { auraTrend, TREND_WEEKS, type AuraStage, type TermEvent } from "./index"
import { fitCommand, parseFit, MODEL_VERSION, type FitCommand, type SirsFit } from "./fit-command"
import { findLikelyMatches, normaliseSuggestion } from "../normalise"

export type AuraFitResult =
  | { kind: "fit"; fit: SirsFit; source: "vendored" | "synthetic"; stageNote: string | null }
  | { kind: "no_data"; term: string; suggestions: string[] }

export type AuraDashboardRow = { term: string; stage: AuraStage | null }

export async function createAuraDashboardRows(
  terms: string[],
  fitTerm: (term: string) => Promise<AuraFitResult>,
): Promise<AuraDashboardRow[]> {
  return Promise.all(terms.map(async (term) => {
    try {
      const outcome = await fitTerm(term)
      return { term, stage: outcome.kind === "fit" ? outcome.fit.stage : null }
    } catch {
      return { term, stage: null }
    }
  }))
}

export interface AuraFitDeps {
  runFit: (cmd: FitCommand) => Promise<{ code: number; stdout: string }>
  getTermEvents: (term: string) => Promise<TermEvent[]>
  listPublishedTermNames: () => Promise<string[]>
  now: () => Date
}

const DAY_MS = 86_400_000

export function createAuraFit(deps: AuraFitDeps) {
  const cache = new Map<string, AuraFitResult>()
  const fitted = (fit: SirsFit, source: "vendored" | "synthetic"): AuraFitResult =>
    ({ kind: "fit", fit, source, stageNote: fit.stage ? null : "No stage yet: the curve hasn't taken off" })

  return async function fitAuraTerm(term: string): Promise<AuraFitResult> {
    const key = `${MODEL_VERSION}:${normaliseSuggestion(term)}`
    const hit = cache.get(key)
    if (hit) return hit
    const now = deps.now()
    const nowIso = now.toISOString().slice(0, 10)

    const vendored = parseFit((await deps.runFit(fitCommand(term, { now: nowIso }))).stdout)
    let result: AuraFitResult | null = vendored.kind === "fit" ? fitted(vendored.fit, "vendored") : null

    if (!result) {
      const counts = auraTrend(await deps.getTermEvents(term), now)
      if (counts.some((c) => c > 0)) {
        const weeks = counts.map((_, i) => new Date(now.getTime() - (TREND_WEEKS - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10))
        const synth = parseFit((await deps.runFit(fitCommand(term, { now: nowIso, counts: { weeks, counts } }))).stdout)
        if (synth.kind === "fit") result = fitted(synth.fit, "synthetic")
      }
    }
    if (result) { cache.set(key, result); return result }

    const names = await deps.listPublishedTermNames()
    const suggestions = findLikelyMatches(term, names).sort((a, b) => b.score - a.score).map((m) => m.candidate).slice(0, 3)
    return { kind: "no_data", term, suggestions }
  }
}
