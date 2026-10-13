// INTEGRATION CONTRACT — suggestion normalisation & deduplication (done in S1)
// (team-owned). Pure functions: no database or network access.
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

import { normalizeKey } from "./similarity"

// Increment whenever normaliseSuggestion's output changes,
// so stored keys can be told apart from stale ones.
export const NORMALISER_VERSION = 1

// Nothing alike.
export const MATCH_SCORE_MIN = 0
// Same key.
export const MATCH_SCORE_MAX = 1
// Starting value, calibrated later in slice D; not used until then.
export const MATCH_THRESHOLD = 0.5
// Default number of matches findLikelyMatches returns.
export const DEFAULT_MATCH_LIMIT = 3

const digitWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
const separatedSingleDigits = /^\s*\d(?:[\s-]+\d)+\s*$/

function expandSeparatedSingleDigits(text: string): string {
  // This excludes multi-digit numbers and leetspeak.
  if (!separatedSingleDigits.test(text)) return text

  return text.replace(/\d/g, (digit) => digitWords[Number(digit)])
}

function collapseRepeatedLetters(text: string): string {
  return text.replace(/(\p{L})\1{2,}/gu, "$1$1")
}

// Slice D adds "trigram" once fuzzy matching lands.
export type MatchReason = "same_key"

export interface LikelyMatch {
  /** The existing lexicon term or suggestion that this one probably duplicates. */
  candidate: string
  /** 0 means nothing alike, 1 means the same key, and anything between is a guess. Never merge on a guess. A reviewer decides. */
  score: number
  /** Short machine-readable reason. See MatchReason. */
  reason: MatchReason
}

/** Canonical form used as the dedup key for a suggestion. */
export function normaliseSuggestion(text: string): string {
  // Convert "6 7" and "6-7" before normalizeKey removes their separators.
  const expandedText = expandSeparatedSingleDigits(text)

  // Strip punctuation first so it cannot split a repeated-letter run.
  const key = normalizeKey(expandedText)
  return collapseRepeatedLetters(key)
}

/** Best matches for `text` among `candidates` (lexicon terms and/or other suggestions), best first. */
export function findLikelyMatches(text: string, candidates: string[], _limit = DEFAULT_MATCH_LIMIT): LikelyMatch[] {
  const inputKey = normaliseSuggestion(text)

  // Punctuation-only input must not match a punctuation-only candidate.
  if (!inputKey) return []

  const matches: LikelyMatch[] = []
  for (const candidate of candidates) {
    const candidateKey = normaliseSuggestion(candidate)

    // Ignore candidates that normalise to an empty key.
    if (!candidateKey) continue

    // This slice returns only exact canonical-key matches; sorting and limiting come later.
    if (candidateKey !== inputKey) continue

    matches.push({ candidate, score: 1, reason: "same_key" })
  }

  return matches
}
