import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { bestSettingIndex, buildModelReports, modelLabel, settingVerdict, wordTypeShares, type SavedCombinedReport } from "@/lib/eval/model-reports"
import { loadModelReports } from "@/lib/eval/saved-reports"
import type { SweepRow } from "@/lib/eval/sweep"
import type { DiscoveryCaseResult } from "@/lib/eval/discovery"

const rate = (numerator: number, denominator: number) => ({ numerator, denominator, value: denominator ? numerator / denominator : null, interval95: null })
const rule = { maxH1: 0.1, minRecall: 0.5, maxErrorRate: 0.1 }
function row(model: string, temperature: number, o: { h1: [number, number]; recall: [number, number]; errors?: number; auc?: number }): SweepRow {
  const errors = o.errors ?? 0
  const reliable = errors <= 0.1 * 128
  const h1 = rate(...o.h1), recall = rate(...o.recall)
  return {
    setting: { model, temperature }, runs: 2, hallucinationRate: h1, hallucinationRange: [h1.value ?? 0, h1.value ?? 0],
    precision: rate(1, 1), recall, falseAcceptRate: rate(0, 10), sensitivityMislabelRate: rate(0, 0), errors, calls: 128, reliable,
    costPer1000CallsUsd: 0, meanLatencyMs: 1000, acceptable: reliable && (h1.value ?? 1) <= 0.1 && (recall.value ?? 0) >= 0.5,
    auc: o.auc ?? 0.7, roc: [{ fpr: 0, tpr: 0, threshold: null }, { fpr: 1, tpr: 1, threshold: 0 }],
  } as SweepRow
}
const result = (id: string, input: string, wordType: DiscoveryCaseResult["wordType"], accepted: boolean | null): DiscoveryCaseResult => {
  const isRealSlang = !wordType.startsWith("invented")
  const outcome = accepted === null ? "error" : accepted ? (isRealSlang ? "true_positive" : "false_positive") : (isRealSlang ? "false_negative" : "true_negative")
  return { id, input, category: isRealSlang ? "valid_slang" : "invented", wordType, split: "dev", dialect: "US", isRealSlang, accepted, outcome,
    definition: null, rating: null, minSensitivity: null, sensitivityMislabel: false, latencyMs: 1, error: null }
}

test("model labels are readable, and unknown models keep their id", () => {
  assert.equal(modelLabel("openai:gpt-6-astra"), "GPT-6 Astra")
  assert.equal(modelLabel("llama3.2:3b"), "Llama 3.2 3B")
  assert.equal(modelLabel("openai:gpt-9"), "gpt-9")
})

test("best setting: highest passing recall, else fewest made-up words, else fewest errors", () => {
  const passing = [row("m", 0, { h1: [0, 36], recall: [46, 78] }), row("m", 1.2, { h1: [0, 36], recall: [52, 78] }), row("m", 0.4, { h1: [9, 36], recall: [70, 78] })]
  assert.equal(bestSettingIndex(passing).index, 1)
  const failing = [row("m", 0, { h1: [18, 36], recall: [65, 78] }), row("m", 0.8, { h1: [14, 36], recall: [54, 78] })]
  assert.deepEqual(bestSettingIndex(failing), { index: 1, reason: "no setting passes the rule; this one makes up the fewest words" })
  const broken = [row("m", 0, { h1: [0, 4], recall: [2, 10], errors: 106 }), row("m", 1.2, { h1: [0, 4], recall: [2, 10], errors: 94 })]
  assert.equal(bestSettingIndex(broken).index, 1)
})

test("the verdict names the failed rule and never recommends an unreliable setting", () => {
  assert.match(settingVerdict(row("m", 0, { h1: [18, 36], recall: [65, 78] }), rule), /^Fails the rule: H1 50\.0% is above 10\.0%\.$/)
  assert.match(settingVerdict(row("m", 0, { h1: [0, 36], recall: [0, 78] }), rule), /recall 0\.0% is below 50\.0%/)
  assert.match(settingVerdict(row("m", 0, { h1: [0, 4], recall: [2, 10], errors: 106 }), rule), /^Unreliable: 106 of 128 calls failed/)
  assert.match(settingVerdict(row("m", 0, { h1: [0, 36], recall: [46, 78] }), rule), /^Passes the rule/)
})

test("word-type shares skip errors and types with no answered words", () => {
  const shares = wordTypeShares([result("1", "rizz", "real-new", true), result("2", "gyat", "real-new", false), result("3", "zorp", "invented-random", null), result("4", "flurb", "invented-plausible", true)])
  assert.deepEqual(shares.map((s) => [s.wordType, s.accepted, s.answered, s.share]), [["real-new", 1, 2, 0.5], ["invented-plausible", 1, 1, 1]])
})

test("builds one view per model from the rows and runs of that setting", () => {
  const report: SavedCombinedReport = {
    datasetVersion: "0.5.0", startedAt: "2026-11-14T13:44:04.108Z", promptVersion: "p", mock: false, split: "dev",
    summary: { rule, rows: [row("a", 0.4, { h1: [0, 1], recall: [1, 1] }), row("a", 0, { h1: [1, 1], recall: [1, 1] }), row("b", 1, { h1: [0, 1], recall: [0, 1] })],
      recommendations: [{ title: "Safest pick", setting: { model: "a", temperature: 0.4 }, why: "x" }] },
    runs: [0, 1].map((repeat) => ({ setting: { model: "a", temperature: 0.4 }, repeat, discovery: { results: [result("1", "flurb", "invented-plausible", repeat === 0), result("2", "rizz", "real-new", true)] } })) as never,
  }
  const views = buildModelReports(report, "f.json")
  assert.deepEqual(views.models.map((m) => m.id), ["a", "b"])
  const a = views.models[0]
  assert.deepEqual(a.settings.map((s) => s.temperature), [0, 0.4], "sorted by temperature")
  assert.equal(a.recommendations.length, 1)
  assert.deepEqual(a.settings[1].madeUp, [{ word: "flurb", times: 1, of: 2 }])
  assert.deepEqual(a.settings[0].wordTypes, [], "no runs saved for that setting")
})

test("the saved 6-model report loads with every model and its numbers", async () => {
  const loaded = await loadModelReports()
  assert.ok(loaded.ok, loaded.ok ? "" : loaded.reason)
  const { reports } = loaded
  assert.match(reports.file, /-sweep-combined-.*\.json$/)
  assert.deepEqual(reports.models.map((m) => m.label).sort(), ["DeepSeek R1 1.5B", "GPT-4o", "GPT-4o mini", "GPT-6 Astra", "Llama 3.2 1B", "Llama 3.2 3B"])
  const astra = reports.models.find((m) => m.id === "openai:gpt-6-astra")!
  assert.deepEqual(astra.settings.map((s) => s.temperature), [1])
  assert.equal(astra.settings[0].recall.value, 1)
  const deepseek = reports.models.find((m) => m.id === "deepseek-r1:1.5b")!
  assert.ok(deepseek.settings.every((s) => !s.reliable))
  assert.equal(JSON.stringify(reports).includes("safety-"), false, "only discovery words reach the page")
})

test("a missing folder, no combined report, or a bad file is a reason, not a crash", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reports-"))
  assert.deepEqual(await loadModelReports(join(dir, "nope")), { ok: false, reason: `No reports folder at ${join(dir, "nope")}.` })
  assert.match((await loadModelReports(dir) as { reason: string }).reason, /No combined sweep report yet/)
  writeFileSync(join(dir, "x-sweep-combined-a.json"), "{")
  assert.match((await loadModelReports(dir) as { reason: string }).reason, /not valid JSON/)
  writeFileSync(join(dir, "y-sweep-combined-a.json"), "{}")
  assert.match((await loadModelReports(dir) as { reason: string }).reason, /y-sweep-combined-a\.json is not a sweep report/)
})
