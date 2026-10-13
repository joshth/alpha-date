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

import { normalizeKey, trigramSimilarity } from "./similarity"

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

// naive suffix list, no real morphology (doubled consonants,
// irregular spelling) — revisit in slice E if more variants need it.
// relevant to Australian/American/UK English lexicon.
// has to be researched for cross cultural suffixes/grammar patterns
// e.g. stems in Japanese  食べません would have stem ません
const commonSuffixes = ["ing", "ed", "s"]

function stripCommonSuffix(key: string): string {
  for (const suffix of commonSuffixes) {
    if (key.length > suffix.length && key.endsWith(suffix)) return key.slice(0, -suffix.length)
  }
  return key
}

// "same_key" is an exact canonical-key match. "trigram" is a fuzzy match
// gated by MIN_FUZZY_KEY_LENGTH and MATCH_THRESHOLD. "stem" is a fallback
// for suffix variants trigram misses (see stripCommonSuffix above).
export type MatchReason = "same_key" | "trigram" | "stem"

// Candidate/input keys shorter than this never get fuzzy-matched (trigram
// or stem), even at high similarity — protects short keys like "mid",
// "sus", "riz" from over-merging with longer unrelated terms. Revisit
// alongside the MATCH_THRESHOLD sweep in slice E.
export const MIN_FUZZY_KEY_LENGTH = 4

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

    if (candidateKey === inputKey) {
      matches.push({ candidate, score: 1, reason: "same_key" })
      continue
    }

    // Short keys are too easy to over-merge on similarity alone
    // ("mid" vs "midnight", "sus" vs "sussy baka") — skip both fuzzy
    // signals below MIN_FUZZY_KEY_LENGTH rather than relying on a score
    // threshold to save them.
    if (inputKey.length < MIN_FUZZY_KEY_LENGTH || candidateKey.length < MIN_FUZZY_KEY_LENGTH) continue

    const score = trigramSimilarity(inputKey, candidateKey)
    if (score >= MATCH_THRESHOLD) {
      matches.push({ candidate, score, reason: "trigram" })
      continue
    }

    // Fallback for suffix variants trigram misses (e.g. "glaze"/"glazing",
    // 0.40 trigram). startsWith (not stem equality) tolerates the silent-e
    // drop before "-ing". Stems must still clear MIN_FUZZY_KEY_LENGTH so
    // over-stripped short stems ("mass" -> "mas") can't false-positive.
    const inputStem = stripCommonSuffix(inputKey)
    const candidateStem = stripCommonSuffix(candidateKey)
    const stemOverlap =
      (inputStem.length >= MIN_FUZZY_KEY_LENGTH && candidateKey.startsWith(inputStem)) ||
      (candidateStem.length >= MIN_FUZZY_KEY_LENGTH && inputKey.startsWith(candidateStem))
    if (stemOverlap) matches.push({ candidate, score, reason: "stem" })
  }

  return matches
}
