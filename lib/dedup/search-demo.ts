import { findLikelyMatches, normaliseSuggestion, type MatchReason } from "@/lib/normalise"

const LABELS: Record<MatchReason, string> = { same_key: "Same key", trigram: "Looks alike (trigram)", stem: "Same stem" }

/** What the Dedup search box shows: the key a suggestion normalises to, and which candidates it would match and why. */
export function searchDemo(text: string, candidates: string[]) {
  const key = normaliseSuggestion(text)
  const matches = findLikelyMatches(text, candidates, candidates.length)
    .map((m) => ({ ...m, label: LABELS[m.reason] }))
    .sort((a, b) => b.score - a.score)
  return { key, matches }
}

const DEMO_TERMS = ["六七", "brainrot", "skibidi", "gyatt"]

/** Every word the search box can match: suggestions, lexicon terms and the demo terms, once each by trimmed lower-case. */
export function searchCandidates(rows: { suggestedTerm: string; count?: number }[], lexicon: string[]): string[] {
  const seen = new Map<string, string>()
  for (const t of [...rows.map((r) => r.suggestedTerm), ...lexicon, ...DEMO_TERMS]) {
    const k = t.trim().toLowerCase()
    if (k && !seen.has(k)) seen.set(k, t.trim())
  }
  return [...seen.values()]
}
