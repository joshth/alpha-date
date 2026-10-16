import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { evaluateSafety } from "@/lib/eval/safety"
import type { GoldenCase } from "@/lib/eval/golden"
import type { SafetyVerdict } from "@/lib/safety/gate"

type SafetyCase = Extract<GoldenCase, { kind: "safety" }>
const fixture = (id: string, action: SafetyCase["safety"]["action"]): SafetyCase => ({
  id, input: `private fixture ${id}`, source: "synthetic", kind: "safety",
  safety: { action, categories: [] },
})
const verdict = (action: SafetyVerdict["action"]): SafetyVerdict => ({
  action, crisis: null, categories: [], decidedBy: "moderation", reason: "test",
})

test("counts confusion matrix with expected rows and actual columns", async () => {
  const entries = [
    fixture("safe-pass", "safe"), fixture("false-refusal", "safe"),
    fixture("crisis-pass", "safeguarding"), fixture("missed-crisis", "safeguarding"),
    fixture("refusal-pass", "refuse"),
  ]
  const predictions = ["safe", "refuse", "safeguarding", "safe", "refuse"] as const
  let index = 0
  const report = await evaluateSafety(entries, async () => verdict(predictions[index++]))
  assert.deepEqual(report.confusionMatrix.actions, ["safe", "refuse", "safeguarding"])
  assert.deepEqual(report.confusionMatrix.counts, {
    safe: { safe: 1, refuse: 1, safeguarding: 0 },
    refuse: { safe: 0, refuse: 1, safeguarding: 0 },
    safeguarding: { safe: 1, refuse: 0, safeguarding: 1 },
  })
  assert.deepEqual(report.actionAgreement, { numerator: 3, denominator: 5, value: 0.6 })
  assert.deepEqual(report.safeguardingRecall, { numerator: 1, denominator: 2, value: 0.5 })
  assert.deepEqual(report.falseRefusalRate, { numerator: 1, denominator: 2, value: 0.5 })
  assert.deepEqual(report.misclassifiedIds, ["false-refusal", "missed-crisis"])
})

test("zero denominators are unmeasured rather than perfect scores", async () => {
  let calls = 0
  const report = await evaluateSafety([], async () => { calls++; return verdict("safe") })
  assert.equal(calls, 0)
  for (const metric of [report.actionAgreement, report.safeguardingRecall, report.falseRefusalRate, report.crisisRecall]) {
    assert.deepEqual(metric, { numerator: 0, denominator: 0, value: null })
  }
})

test("checks crisis kind separately from action agreement", async () => {
  const entry = fixture("wrong-crisis", "safeguarding")
  entry.safety.crisis = "self_harm"
  const report = await evaluateSafety([entry], async () => ({
    ...verdict("safeguarding"), crisis: "harm_to_others",
  }))
  assert.equal(report.safeguardingRecall.value, 1)
  assert.equal(report.crisisRecall.value, 0)
  assert.equal(report.actionAgreement.value, 1)
  assert.deepEqual(report.crisisMismatchIds, ["wrong-crisis"])
  assert.deepEqual(report.misclassifiedIds, ["wrong-crisis"])
})

test("reports missing minimum categories and permits extra detected categories", async () => {
  const entry = fixture("missing-category", "safe")
  entry.safety.categories = ["suicide_self_harm", "eating_disorder"]
  const report = await evaluateSafety([entry], async () => ({
    ...verdict("safe"), categories: ["suicide_self_harm", "violence_threat"],
  }))
  assert.deepEqual(report.categoryMismatches, [{ id: entry.id, missingCategories: ["eating_disorder"] }])
  const extra = await evaluateSafety([fixture("extra-category", "safe")], async () => ({
    ...verdict("safe"), categories: ["suicide_self_harm"],
  }))
  assert.deepEqual(extra.misclassifiedIds, [])
})

test("runs only safety cases and forwards the selected surface", async () => {
  const entries: GoldenCase[] = [
    { id: "discovery", input: "rizz", source: "synthetic", kind: "discovery", discovery: { isRealSlang: true } },
    fixture("safety", "safe"),
    { id: "dedup", input: "rizz", source: "synthetic", kind: "dedup", dedup: { candidate: "rizz", sameTerm: true } },
  ]
  const calls: unknown[] = []
  const report = await evaluateSafety(entries, async (text, surface) => {
    calls.push([text, surface])
    return verdict("safe")
  }, "suggestion")
  assert.equal(report.total, 1)
  assert.deepEqual(calls, [["private fixture safety", "suggestion"]])
  assert.equal(report.surface, "suggestion")
})

test("defaults to search and never exports fixture input", async () => {
  const entry = fixture("privacy", "safe")
  const report = await evaluateSafety([entry], async (_, surface) => {
    assert.equal(surface, "search")
    return verdict("refuse")
  })
  assert.equal(JSON.stringify(report).includes(entry.input), false)
  assert.deepEqual(report.misclassifiedIds, [entry.id])
})

test("adds a distinct matrix column for gentle support without changing the three core actions", async () => {
  const gentle = "gentle_support" as SafetyVerdict["action"]
  const report = await evaluateSafety([fixture("gentle", "safe")], async () => verdict(gentle))
  assert.equal(report.confusionMatrix.counts.safe.gentle_support, 1)
  assert.equal(report.falseRefusalRate.value, 0)
  assert.deepEqual(report.actionMismatchIds, ["gentle"])
})

test("does not convert a failed evaluator dependency into a valid score", async () => {
  await assert.rejects(evaluateSafety([fixture("failed", "safe")], async () => {
    throw new Error("gate failure")
  }), /gate failure/)
})
