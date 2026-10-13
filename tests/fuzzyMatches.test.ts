import { findLikelyMatches, MATCH_SCORE_MAX, MATCH_THRESHOLD, MIN_FUZZY_KEY_LENGTH } from "@/lib/normalise"
import assert from "node:assert/strict"
import { test } from "node:test"
import goldenSet from "../eval/golden-set.json"

test("findLikelyMatches returns a trigram match for a close respelling", () => {
  const matches = findLikelyMatches("gyat!!", ["Gyatt"])

  assert.equal(matches.length, 1)
  assert.equal(matches[0].candidate, "Gyatt")
  assert.equal(matches[0].reason, "trigram")
  assert.ok(matches[0].score >= MATCH_THRESHOLD)
  assert.ok(matches[0].score < MATCH_SCORE_MAX)
  assert.ok(Math.abs(matches[0].score - 0.57) < 0.01)
})

test("same_key still wins and is not duplicated by a trigram entry", () => {
  // Identical keys must short-circuit to exactly one same_key entry,
  // never a second trigram entry for the same candidate.
  const matches = findLikelyMatches("brainrott", ["Brain Rot"])

  assert.deepEqual(matches, [{ candidate: "Brain Rot", score: 1, reason: "same_key" }])
})

test("golden-set dedup pairs labelled sameTerm:false stay unmatched", () => {
  const nonMatches = goldenSet.cases.filter(
    (entry): entry is typeof entry & { dedup: { candidate: string; sameTerm: false } } =>
      entry.kind === "dedup" && entry.dedup?.sameTerm === false,
  )

  assert.ok(nonMatches.length > 0)
  for (const { input, dedup } of nonMatches) {
    assert.deepEqual(findLikelyMatches(input, [dedup.candidate]), [])
  }
})

test("the fuzzy gate blocks keys shorter than MIN_FUZZY_KEY_LENGTH", () => {
  // "riz" (3 chars, one below the gate) vs "rizz" is a near-perfect trigram
  // match, but must never surface -- short keys are too easy to over-merge.
  assert.equal(MIN_FUZZY_KEY_LENGTH, 4)
  assert.deepEqual(findLikelyMatches("riz", ["rizz"]), [])
})

test("the stem fallback catches a suffix variant trigram misses", () => {
  // trigramSimilarity("glaze", "glazing") is ~0.40, below MATCH_THRESHOLD,
  // but "glazing" strips to "glaz" and "glaze" starts with "glaz" --
  // caught by the stem fallback instead of being a documented miss.
  const matches = findLikelyMatches("glaze", ["glazing"])

  assert.equal(matches.length, 1)
  assert.equal(matches[0].candidate, "glazing")
  assert.equal(matches[0].reason, "stem")
  assert.ok(matches[0].score < MATCH_THRESHOLD)
})

test("the stem fallback's own length check blocks an over-stripped stem", () => {
  // Both raw keys clear the outer MIN_FUZZY_KEY_LENGTH gate (4 chars each),
  // but stripping "s" from "mass" leaves "mas" (3 chars) -- too short to
  // trust as a stem match, even though "mas" is a prefix of "mass".
  assert.deepEqual(findLikelyMatches("mass", ["mas"]), [])
})

test("a clearly dissimilar pair stays unmatched", () => {
  assert.deepEqual(findLikelyMatches("brainrot", ["mid"]), [])
})
