// MCP tools for assistive tech: short plain-text answers (A11Y-15), lexicon text fenced as data (A11Y-16).
import { AURA_STAGE_LABELS, auraTrend, LOW_CONFIDENCE, type AuraScore, type scoreTermLifecycle } from "@/lib/aura"
import { asData } from "@/lib/mcp/data"
import { answer } from "@/lib/mcp/format"
import { findLikelyMatches, normaliseSuggestion } from "@/lib/normalise"
import type { checkInputSafety } from "@/lib/safety/gate"
import type { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"

export interface DecoderDeps {
  checkInputSafety: typeof checkInputSafety
  getTermByKey: typeof getTermByKey
  listPublishedTermNames: typeof listPublishedTermNames
  getTermEvents: typeof getTermEvents
  scoreTermLifecycle: typeof scoreTermLifecycle
  now: () => Date
}

/** First line of an answer: the stage with a plain-words confidence. */
export function auraSummary(name: string, score: AuraScore | null): string {
  if (!score) return `${name}: No stage yet`
  const label = AURA_STAGE_LABELS[score.stage]
  if (score.confidence < LOW_CONFIDENCE) return `${name}: ${label} (low confidence)`
  return `${name}: ${label}, ${score.confidence >= 0.7 ? "high" : "medium"} confidence`
}

export function createDecoderTools(deps: DecoderDeps) {
  /** Never guesses a definition: names up to 3 published terms the query is close to (A11Y-14). */
  async function notFound(query: string): Promise<string> {
    const matches = findLikelyMatches(query, await deps.listPublishedTermNames()).slice(0, 3).map((m) => m.candidate)
    return answer(`${query}: not found`, [matches.length ? `Likely matches: ${matches.join(", ")}` : "No close matches in the lexicon."])
  }

  /** The published term for a query, with its Aura score, or null. Pending and rejected terms are never shown. */
  async function findScored(query: string) {
    const record = await deps.getTermByKey(normaliseSuggestion(query))
    if (!record || record.status !== "published") return null
    const events = await deps.getTermEvents(record.term.term)
    return { term: record.term, events, score: deps.scoreTermLifecycle(events, deps.now()) }
  }

  return {
    async lookupTerm(query: string): Promise<string> {
      const found = await findScored(query)
      if (!found) return notFound(query)
      const { term, score } = found
      return answer(auraSummary(term.term, score), [
        "Meaning:",
        asData(term.definition),
        ...(score ? [`Aura: ${score.explanation}`] : []),
        `Safeguarding note: ${term.sensitivityRating}. ${term.cautionaryNotes ?? ""}`.trim(),
      ])
    },

    async getAura(query: string): Promise<string> {
      const found = await findScored(query)
      if (!found) return notFound(query)
      const { term, score } = found
      return answer(auraSummary(term.term, score), [score ? score.explanation : "There is too little search data to give a stage."])
    },

    /** Numbers only: the user's own device turns them into pitch or vibration (A11Y-17). */
    async getAuraTrend(query: string): Promise<string> {
      const found = await findScored(query)
      if (!found) return notFound(query)
      const { term, events, score } = found
      if (!score) return answer(auraSummary(term.term, score), ["There is too little search data to give a trend."])
      const series = auraTrend(events, deps.now()).map((v) => v.toFixed(2)).join(", ")
      return answer(auraSummary(term.term, score), [score.explanation, `Weekly trend, oldest first, 0 to 1: ${series}`])
    },
  }
}
