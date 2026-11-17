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
