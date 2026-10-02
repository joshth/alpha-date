// INTEGRATION CONTRACT — suggestion normalisation & deduplication (Sprint 2,
// team-owned). Pure functions: no database or network access.
//
// Goal: variants of the same suggestion ("brainrot", "brain rot", "brain-rot",
// "brainrottt") merge into one record with a combined count, and suggestions
// that match an EXISTING lexicon term ("gyat!!" → "Gyatt") are surfaced as
// likely matches instead of new terms.
//
// Starting points provided (copied from production, ./similarity.ts):
// normalizeKey() and trigramSimilarity(). Production already uses these for
// lookups; suggestions need more (repeated letters, number words, common
// respellings) — but beware over-merging distinct terms ("mid" vs "midd"?).
// Measure merge precision with labelled pairs in the golden set.

export interface LikelyMatch {
  /** The existing lexicon term or suggestion that this one probably duplicates. */
  candidate: string
  /** 0-1; document what the scale means and the threshold you chose. */
  score: number
  /** Short machine-readable reason, e.g. "same_key", "trigram", "repeated_letters". */
  reason: string
}

/** Canonical form used as the dedup key for a suggestion. */
export function normaliseSuggestion(_text: string): string {
  throw new Error("normaliseSuggestion: not implemented yet (Sprint 2)")
}

/** Best matches for `text` among `candidates` (lexicon terms and/or other suggestions), best first. */
export function findLikelyMatches(_text: string, _candidates: string[], _limit = 3): LikelyMatch[] {
  throw new Error("findLikelyMatches: not implemented yet (Sprint 2)")
}
