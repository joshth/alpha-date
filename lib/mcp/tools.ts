// MCP tools for assistive tech: short plain-text answers (A11Y-15), lexicon text fenced as data (A11Y-16).
import { AURA_STAGE_LABELS, LOW_CONFIDENCE, type AuraScore, type scoreTermLifecycle } from "@/lib/aura"
import { asData } from "@/lib/mcp/data"
import { answer } from "@/lib/mcp/format"
import { normaliseSuggestion } from "@/lib/normalise"
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
  return {
    async lookupTerm(query: string): Promise<string> {
      const record = await deps.getTermByKey(normaliseSuggestion(query))
      if (!record || record.status !== "published") return answer(`${query}: not found`, [])
      const { term } = record
      const score = deps.scoreTermLifecycle(await deps.getTermEvents(term.term), deps.now())
      return answer(auraSummary(term.term, score), [
        "Meaning:",
        asData(term.definition),
        ...(score ? [`Aura: ${score.explanation}`] : []),
        `Safeguarding note: ${term.sensitivityRating}. ${term.cautionaryNotes ?? ""}`.trim(),
      ])
    },
  }
}
