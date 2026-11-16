import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { mergeQuality } from "@/lib/dedup/threshold"
import { findLikelyMatches, MATCH_THRESHOLD } from "@/lib/normalise"
import { loadGoldenSet } from "@/lib/eval/golden"

const cases = [
  { input: "brainrot", candidate: "brain rot", sameTerm: true }, // same_key, 1
  { input: "sigma", candidate: "sigmas", sameTerm: true }, // trigram only, 0.625
  { input: "rizz", candidate: "mid", sameTerm: false }, // 0
  { input: "rizz", candidate: "rizzler", sameTerm: false }, // stem, 0.61
]

test("fixture pairs behave as described", () => {
  const s = (c: (typeof cases)[number]) => findLikelyMatches(c.input, [c.candidate])[0]?.score ?? 0
  assert.equal(s(cases[0]), 1)
  assert.ok(s(cases[1]) >= 0.5 && s(cases[1]) < 0.95)
  assert.ok(s(cases[2]) < 0.5)
  assert.ok(s(cases[3]) >= 0.5 && s(cases[3]) < 0.95)
})

test("threshold 0.5", () => {
  assert.deepEqual(mergeQuality(cases, 0.5), { tp: 2, fp: 1, fn: 0, tn: 1, precision: 2 / 3, recall: 1 })
})

test("threshold 0.95", () => {
  assert.deepEqual(mergeQuality(cases, 0.95), { tp: 1, fp: 0, fn: 1, tn: 2, precision: 1, recall: 0.5 })
})

test("null when denominator is 0", () => {
  const q = mergeQuality([cases[2]], 0.95)
  assert.deepEqual([q.precision, q.recall], [null, null])
})

test("golden set dedup cases", () => {
  const golden = loadGoldenSet().cases.flatMap((c) =>
    c.kind === "dedup" ? [{ input: c.input, candidate: c.dedup.candidate, sameTerm: c.dedup.sameTerm }] : [])
  const q = mergeQuality(golden, MATCH_THRESHOLD)
  assert.equal(q.tp + q.fp + q.fn + q.tn, 8)
  assert.ok(typeof q.recall === "number" && q.recall >= 0 && q.recall <= 1)
})
