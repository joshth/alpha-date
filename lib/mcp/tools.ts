// MCP tools for assistive tech: plain text and lexicon data fences.
import { AURA_STAGE_LABELS, LOW_CONFIDENCE } from "@/lib/aura"
import type { AuraFitResult } from "@/lib/aura/fit"
import { lifecycleRows, trendSentence } from "@/lib/aura/trend-text"
import { asData } from "@/lib/mcp/data"
import { answer } from "@/lib/mcp/format"
import { findLikelyMatches, normaliseSuggestion } from "@/lib/normalise"
import type { checkInputSafety } from "@/lib/safety/gate"
import { prepareSafetyInput } from "@/lib/safety/input"
import { resourcesFor } from "@/lib/safety/resources"
import { safetyResponseMessage } from "@/lib/safety/responses"
import type { getTermByKey, listPublishedTermNames } from "@/lib/terms-store"

export interface DecoderDeps {
  checkInputSafety: typeof checkInputSafety
  getTermByKey: typeof getTermByKey
  listPublishedTermNames: typeof listPublishedTermNames
  fitAuraTerm: (term: string) => Promise<AuraFitResult>
}

export function auraSummary(name: string, result: AuraFitResult): string {
  const fit = result.kind === "fit" ? result.fit : null
  if (!fit?.stage) return `${name}: No stage yet`
  const label = AURA_STAGE_LABELS[fit.stage]
  if (fit.confidence < LOW_CONFIDENCE) return `${name}: ${label} (low confidence)`
  return `${name}: ${label}, ${fit.confidence >= 0.7 ? "high" : "medium"} confidence`
}

export function createDecoderTools(deps: DecoderDeps) {
  async function blocked(query: string): Promise<string | null> {
    const verdict = await deps.checkInputSafety(prepareSafetyInput(query), "search")
    if (verdict.action === "safe") return null
    const message = safetyResponseMessage(verdict, "search")
    const firstSentence = message.slice(0, message.indexOf(".") + 1)
    const help = resourcesFor(verdict.categories).map((r) =>
      [r.name, r.detail, r.phone && `Phone ${r.phone}`, r.text && `Text ${r.text}`, r.url].filter(Boolean).join(". "))
    return answer(firstSentence, [message.slice(firstSentence.length), ...help])
  }

  async function notFound(query: string): Promise<string> {
    const matches = findLikelyMatches(query, await deps.listPublishedTermNames()).slice(0, 3).map((m) => m.candidate)
    return answer(`${query}: not found`, [matches.length ? `Likely matches: ${matches.join(", ")}` : "No close matches in the lexicon."])
  }

  // Publication is checked before the fit sees the term.
  async function findFitted(query: string) {
    const record = await deps.getTermByKey(normaliseSuggestion(query))
    if (!record || record.status !== "published") return null
    return { term: record.term, result: await deps.fitAuraTerm(record.term.term) }
  }

  return {
    async lookupTerm(query: string): Promise<string> {
      const refusal = await blocked(query)
      if (refusal) return refusal
      const found = await findFitted(query)
      if (!found) return notFound(query)
      const { term, result } = found
      return answer(auraSummary(term.term, result), [
        "Meaning:", asData(term.definition),
        ...(result.kind === "fit" ? [`Aura: ${trendSentence(result.fit)}`] : []),
        `Safeguarding note: ${term.sensitivityRating}. ${term.cautionaryNotes ?? ""}`.trim(),
      ])
    },
    async getAura(query: string): Promise<string> {
      const refusal = await blocked(query)
      if (refusal) return refusal
      const found = await findFitted(query)
      if (!found) return notFound(query)
      const { term, result } = found
      return answer(auraSummary(term.term, result), [result.kind === "fit" ? trendSentence(result.fit) : "There is too little search data to give a stage."])
    },
    async getAuraTrend(query: string): Promise<string> {
      const refusal = await blocked(query)
      if (refusal) return refusal
      const found = await findFitted(query)
      if (!found) return notFound(query)
      const { term, result } = found
      if (result.kind !== "fit" || !result.fit.stage) return answer(auraSummary(term.term, result), ["There is too little search data to give a trend."])
      const rows = lifecycleRows(result.fit).slice(-26)
      return answer(auraSummary(term.term, result), [
        trendSentence(result.fit),
        `Observed interest, oldest first, 0 to 1: ${rows.map((row) => row.interest.toFixed(2)).join(", ")}`,
        `Fitted interest, oldest first, 0 to 1: ${rows.map((row) => row.fitted.toFixed(2)).join(", ")}`,
      ])
    },
  }
}
