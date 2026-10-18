import "./setup"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { GenerateDiscovery } from "@/lib/discovery/discover"
import type { DiscoveryOutput } from "@/lib/discovery/prompt"
import { evaluateDiscovery } from "@/lib/eval/discovery"
import { type GoldenCase, loadGoldenSet } from "@/lib/eval/golden"
import { rate, wilsonInterval } from "@/lib/eval/metrics"
import { mockDiscovery } from "@/lib/_stubs/fixtures/mock-discovery"

const close = (actual: number | null | undefined, expected: number, label: string) =>
  assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) < 1e-4, `${label}: ${actual} vs ${expected}`)

const safe = { action: "safe" as const, categories: [] }
const discovery = (
  id: string,
  input: string,
  category: "valid_slang" | "invented" | "non_slang",
  minSensitivity?: "Use With Caution",
): GoldenCase => ({
  id,
  input,
  source: "test",
  kind: "discovery",
  category,
  safety: safe,
  discovery: { isRealSlang: category === "valid_slang", ...(minSensitivity ? { minSensitivity } : {}) },
})

// Hand-computed fixture. What the fake model does with each input:
//   real-1  accepted, rated harmless but needs caution  -> TP + sensitivity mislabel
//   real-2  accepted, rated caution                      -> TP
//   real-3  isLegit but blank definition (app drops it)  -> FN
//   fake-1  accepted                                     -> FP, counts for H1
//   fake-2  rejected                                     -> TN
//   fake-3  rejected                                     -> TN
//   word-1  accepted (ordinary word)                     -> FP, not H1
//   word-2  rejected                                     -> TN
//   down-1  provider throws                              -> error, in no denominator
//   safety-x  a safety case                              -> never sent to the model
// So: TP 2, FP 2, FN 1, TN 3; precision 2/4, recall 2/3, H1 1/3,
// false-accept 2/5, mislabel 1/2.
const fixture: GoldenCase[] = [
  discovery("real-1", "realone", "valid_slang", "Use With Caution"),
  discovery("real-2", "realtwo", "valid_slang", "Use With Caution"),
  discovery("real-3", "realthree", "valid_slang"),
  discovery("fake-1", "fakeone", "invented"),
  discovery("fake-2", "faketwo", "invented"),
  discovery("fake-3", "fakethree", "invented"),
  discovery("word-1", "wordone", "non_slang"),
  discovery("word-2", "wordtwo", "non_slang"),
  discovery("down-1", "downone", "non_slang"),
  {
    id: "safety-x",
    input: "SYNTHETIC-SAFETY-INPUT",
    source: "test",
    kind: "safety",
    category: "safeguarding",
    safety: { action: "safeguarding", crisis: "self_harm", categories: ["suicide_self_harm"] },
  },
]

const answers: Record<string, DiscoveryOutput> = {
  realone: { isLegit: true, definition: "d", sensitivityRating: "Generally Harmless" },
  realtwo: { isLegit: true, definition: "d", sensitivityRating: "Use With Caution" },
  realthree: { isLegit: true, definition: "   " },
  fakeone: { isLegit: true, definition: "made up", sensitivityRating: "Generally Harmless" },
  faketwo: { isLegit: false },
  fakethree: { isLegit: false },
  wordone: { isLegit: true, definition: "an ordinary word", sensitivityRating: "Generally Harmless" },
  wordtwo: { isLegit: false },
}

function fakeModel(seen: string[]): GenerateDiscovery {
  return async ({ searchTerm }) => {
    seen.push(searchTerm)
    if (searchTerm === "downone") throw new Error("Simulated AI provider failure")
    return answers[searchTerm]
  }
}

test("wilson interval matches hand-computed values", () => {
  const third = wilsonInterval(1, 3)!
  close(third[0], 0.0615, "1/3 lower")
  close(third[1], 0.7923, "1/3 upper")
  const none = wilsonInterval(0, 10)!
  assert.equal(none[0], 0)
  close(none[1], 0.2775, "0/10 upper")
  const all = wilsonInterval(10, 10)!
  close(all[0], 0.7225, "10/10 lower")
  assert.equal(all[1], 1)
  assert.equal(wilsonInterval(0, 0), null)
  assert.deepEqual(rate(0, 0), { numerator: 0, denominator: 0, value: null, interval95: null })
})

test("discovery metrics match the hand-computed fixture", async () => {
  const seen: string[] = []
  const report = await evaluateDiscovery(fixture, fakeModel(seen))

  assert.equal(report.total, 9)
  assert.equal(report.scored, 8)
  assert.deepEqual(report.confusion, { truePositive: 2, falsePositive: 2, falseNegative: 1, trueNegative: 3 })
  assert.deepEqual([report.precision.numerator, report.precision.denominator], [2, 4])
  assert.deepEqual([report.recall.numerator, report.recall.denominator], [2, 3])
  assert.deepEqual([report.hallucinationRate.numerator, report.hallucinationRate.denominator], [1, 3])
  close(report.hallucinationRate.interval95?.[0], 0.0615, "H1 lower")
  close(report.hallucinationRate.interval95?.[1], 0.7923, "H1 upper")
  assert.deepEqual([report.falseAcceptRate.numerator, report.falseAcceptRate.denominator], [2, 5])
  assert.deepEqual([report.sensitivityMislabelRate.numerator, report.sensitivityMislabelRate.denominator], [1, 2])

  assert.deepEqual(report.hallucinatedIds, ["fake-1"])
  assert.deepEqual(report.falsePositiveIds, ["fake-1", "word-1"])
  assert.deepEqual(report.falseNegativeIds, ["real-3"])
  assert.deepEqual(report.sensitivityMislabelIds, ["real-1"])
  assert.deepEqual(report.errorIds, ["down-1"])
  assert.deepEqual(report.acceptedByCategory.invented, rate(1, 3))
})

test("safety cases are never sent to the discovery model", async () => {
  const seen: string[] = []
  const report = await evaluateDiscovery(fixture, fakeModel(seen))
  assert.ok(!seen.includes("SYNTHETIC-SAFETY-INPUT"))
  assert.equal(seen.length, 9)
  assert.ok(report.results.every((r) => r.id !== "safety-x"))
})

test("latency is measured per case and summarised", async () => {
  let clock = 0
  const report = await evaluateDiscovery(fixture.slice(0, 3), fakeModel([]), { now: () => (clock += 5) })
  assert.deepEqual(report.results.map((r) => r.latencyMs), [5, 5, 5])
  assert.equal(report.latency.totalMs, 15)
  assert.equal(report.latency.meanMs, 5)
  assert.equal(report.calls, 3)
})

test("E0: two mock runs over the golden set give identical results", async () => {
  const golden = loadGoldenSet()
  const mock: GenerateDiscovery = async ({ searchTerm }) => mockDiscovery(searchTerm)
  const strip = (r: Awaited<ReturnType<typeof evaluateDiscovery>>) => {
    const { latency: _latency, results, ...rest } = r
    return { ...rest, results: results.map(({ latencyMs: _ms, ...result }) => result) }
  }
  const first = await evaluateDiscovery(golden.cases, mock)
  const second = await evaluateDiscovery(golden.cases, mock)
  assert.deepEqual(strip(first), strip(second))
  assert.equal(first.total, golden.cases.filter((c) => c.kind === "discovery").length)
  assert.equal(first.errorIds.length, 0)
})
