import type { LikelyMatch } from "@/lib/normalise"
import {
  findLikelyMatches,
  MATCH_SCORE_MIN,
  MATCH_SCORE_MAX,
  MATCH_THRESHOLD,
  DEFAULT_MATCH_LIMIT,
} from "@/lib/normalise"
import assert from "node:assert/strict"
import { test } from "node:test"

// @ts-expect-error "same-key" is not an allowed reason
const bad: LikelyMatch = { candidate: "x", score: 1, reason: "same-key" }
void bad

test("score scale constants", () => {
  assert.equal(MATCH_SCORE_MIN, 0)
  assert.equal(MATCH_SCORE_MAX, 1)
})

test("threshold lies strictly between min and max", () => {
  assert.equal(MATCH_THRESHOLD, 0.5)
  assert.ok(MATCH_THRESHOLD > MATCH_SCORE_MIN)
  assert.ok(MATCH_THRESHOLD < MATCH_SCORE_MAX)
})

test("default match limit is unchanged", () => {
  assert.equal(DEFAULT_MATCH_LIMIT, 3)
})

test("existing same-key behaviour is preserved", () => {
  const [match] = findLikelyMatches("brainrot", ["Brain Rot"])
  assert.equal(match.reason, "same_key")
  assert.equal(match.score, MATCH_SCORE_MAX)
})
