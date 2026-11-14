import "./setup"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import type { GenerateDiscovery } from "@/lib/discovery/discover"
import { summariseCost } from "@/lib/eval/cost"
import { evaluateDiscovery } from "@/lib/eval/discovery"
import { type GoldenCase, splitFor } from "@/lib/eval/golden"
import { rate } from "@/lib/eval/metrics"
import { rocSvg } from "@/lib/eval/roc-chart"
import {
  acceptanceScores,
  combineSweeps,
  DEFAULT_TEMPERATURES,
  parseSweepArgs,
  recommend,
  rocCurve,
  type SweepRow,
  type SweepRun,
  type SweepSetting,
  summariseSweep,
  sweepMarkdown,
  sweepSettings,
  withDiscoverySetting,
  writeSweepReport,
} from "@/lib/eval/sweep"

const safe = { action: "safe" as const, categories: [] }
const discovery = (id: string, category: "valid_slang" | "invented"): GoldenCase => ({
  id,
  input: id,
  source: "test",
  kind: "discovery",
  category,
  safety: safe,
  discovery: {
    isRealSlang: category === "valid_slang",
    wordType: category === "valid_slang" ? "real-new" : "invented-plausible",
    split: splitFor(id),
    dialect: "US",
  },
})

// 4 real slang words and 4 made-up ones.
const cases = [
  ...["real-1", "real-2", "real-3", "real-4"].map((id) => discovery(id, "valid_slang")),
  ...["fake-1", "fake-2", "fake-3", "fake-4"].map((id) => discovery(id, "invented")),
]

// A fake model that reads the swept settings the same way the real stub does
// (from the environment). It always accepts real slang; how many made-up
// words it accepts depends on the model and the temperature:
//   big   @ 0 -> 0 of 4,  big   @ 1.3 -> 3 of 4
//   small @ 0 -> 0 of 4,  small @ 1.3 -> 4 of 4
const fakeModel: GenerateDiscovery = async ({ searchTerm }) => {
  const hot = Number(process.env.LLM_TEMPERATURE) >= 1
  const fakesAccepted = !hot ? 0 : process.env.LLM_MODEL === "small" ? 4 : 3
  const accepted = searchTerm.startsWith("real") || Number(searchTerm.split("-")[1]) <= fakesAccepted
  return accepted ? { isLegit: true, definition: `meaning of ${searchTerm}` } : { isLegit: false }
}

const PER_1000: Record<string, number> = { big: 0.5, small: 0 }

async function sweep(models: string[], temperatures: number[], repeats = 2): Promise<SweepRun[]> {
  const runs: SweepRun[] = []
  for (const setting of sweepSettings({ models, temperatures })) {
    for (let repeat = 0; repeat < repeats; repeat++) {
      const result = await withDiscoverySetting(setting, repeat, () => evaluateDiscovery(cases, fakeModel))
      runs.push({
        setting,
        repeat,
        config: { mock: false, model: setting.model, temperature: setting.temperature, seed: null, baseURL: null, promptVersion: "p" },
        discovery: result,
        cost: { ...summariseCost([], null), costPer1000CallsUsd: PER_1000[setting.model] },
        timing: { wallClockMs: 1000, callsPerMinute: 480 },
      })
    }
  }
  return runs
}

test("sweep flags: defaults, lists and clear errors", () => {
  const defaults = parseSweepArgs(["--sweep"], "llama3.2:3b")
  assert.deepEqual(defaults, { models: ["llama3.2:3b"], temperatures: DEFAULT_TEMPERATURES, repeats: 3, maxH1: 0.1, minRecall: 0.5, maxErrorRate: 0.1 })
  const custom = parseSweepArgs(
    ["--sweep", "--models", "a, b", "--temperatures", "0,1.3", "--repeats", "3", "--max-h1", "0.05", "--min-recall", "0.6", "--max-error-rate", "0.2"],
    "x",
  )
  assert.deepEqual(custom, { models: ["a", "b"], temperatures: [0, 1.3], repeats: 3, maxH1: 0.05, minRecall: 0.6, maxErrorRate: 0.2 })
  assert.throws(() => parseSweepArgs(["--temperatures", "0,3"], "x"), /--temperatures must be numbers from 0 to 2/)
  assert.throws(() => parseSweepArgs(["--repeats", "1.5"], "x"), /--repeats must be a whole number/)
  assert.throws(() => parseSweepArgs(["--max-h1", "10"], "x"), /--max-h1 must be a fraction/)
})

test("openai: models need a key, and mixing them with local models needs LLM_BASE_URL", () => {
  const real = { MOCK_LLM: "false" }
  const args = ["--models", "llama3.2:3b,openai:gpt-4o-mini"]
  assert.throws(() => parseSweepArgs(args, "x", { ...real, LLM_BASE_URL: "http://localhost:11434/v1" }), /need OPENAI_API_KEY/)
  assert.throws(() => parseSweepArgs(args, "x", { ...real, OPENAI_API_KEY: "test-key" }), /needs LLM_BASE_URL/)
  assert.throws(() => parseSweepArgs(["--models", "openai:"], "x", { ...real, OPENAI_API_KEY: "test-key" }), /needs a model name/)
  const ok = parseSweepArgs(args, "x", { ...real, OPENAI_API_KEY: "test-key", LLM_BASE_URL: "http://localhost:11434/v1" })
  assert.deepEqual(ok.models, ["llama3.2:3b", "openai:gpt-4o-mini"])
  assert.doesNotThrow(() => parseSweepArgs(args, "x", {}), "mock runs need no key")
})

test("an openai: setting goes to OpenAI; a plain name goes to LLM_BASE_URL; both are restored", async () => {
  const before = process.env.LLM_BASE_URL
  process.env.LLM_BASE_URL = "http://localhost:11434/v1"
  const seen = () => ({ model: process.env.LLM_MODEL, baseURL: process.env.LLM_BASE_URL })
  try {
    assert.deepEqual(await withDiscoverySetting({ model: "openai:gpt-4o-mini", temperature: 0 }, 0, async () => seen()), {
      model: "gpt-4o-mini",
      baseURL: undefined,
    })
    assert.deepEqual(await withDiscoverySetting({ model: "llama3.2:3b", temperature: 0 }, 0, async () => seen()), {
      model: "llama3.2:3b",
      baseURL: "http://localhost:11434/v1",
    })
    assert.equal(process.env.LLM_BASE_URL, "http://localhost:11434/v1")
  } finally {
    if (before === undefined) delete process.env.LLM_BASE_URL
    else process.env.LLM_BASE_URL = before
  }
})

test("AUC matches a hand-worked example and counts ties as half", () => {
  // Real slang scored 1 and 0.5; non-slang scored 0.5 and 0.
  // Pairs (real, not): (1,.5)=1, (1,0)=1, (.5,.5)=.5, (.5,0)=1 -> 3.5 / 4 = 0.875.
  const { auc, points } = rocCurve([
    { score: 1, positive: true },
    { score: 0.5, positive: true },
    { score: 0.5, positive: false },
    { score: 0, positive: false },
  ])
  assert.equal(auc, 0.875)
  assert.deepEqual(
    points.map((p) => [p.fpr, p.tpr]),
    [[0, 0], [0, 0.5], [0.5, 1], [1, 1]],
  )
  assert.deepEqual(rocCurve([{ score: 1, positive: true }]), { auc: null, points: [] }, "no AUC without both kinds of word")
})

test("each word's score is the share of answered repeats that accepted it", () => {
  const run = (accepted: (boolean | null)[]) =>
    ({ discovery: { results: accepted.map((a, i) => ({ id: `w${i}`, isRealSlang: i === 0, accepted: a })) } }) as unknown as SweepRun
  const scores = acceptanceScores([run([true, false, null]), run([true, true, true])])
  assert.deepEqual(scores, [
    { score: 1, positive: true },
    { score: 0.5, positive: false },
    { score: 1, positive: false },
  ])
})

test("the sweep gives AUC per setting and business recommendations with reasons", async () => {
  const summary = summariseSweep(await sweep(["big", "small"], [0, 1.3]), { maxH1: 0.1, minRecall: 0.5 })
  const auc = Object.fromEntries(summary.rows.map((r) => [`${r.setting.model}@${r.setting.temperature}`, r.auc]))
  // big@1.3 accepts 3 of 4 made-up words: real 1 vs fakes (1,1,1,0) -> (0.5*3 + 1) / 4.
  assert.deepEqual(auc, { "big@0": 1, "big@1.3": 0.625, "small@0": 1, "small@1.3": 0.5 })

  const pick = Object.fromEntries(summary.recommendations.map((r) => [r.title, `${r.setting.model}@${r.setting.temperature}`]))
  assert.equal(pick["Budget pick"], "small@0", "cheapest setting that passes the rule")
  assert.equal(pick["Safest pick (fewest made-up meanings)"], "small@0", "0% H1, full recall, and cheaper than big@0")
  assert.equal(pick["Best judgement (highest AUC)"], "big@0")
  assert.equal(pick.Avoid, "small@1.3", "it accepted every made-up word")
  assert.ok(summary.recommendations.every((r) => r.why.length > 20), "every recommendation says why")

  const svg = rocSvg(summary.rows, "test chart")
  assert.ok(svg?.includes("big @ 0 · AUC 1.00") && svg.includes("small @ 0 · AUC 1.00"), "one line per model, best temperature")
  assert.equal(rocSvg([], "empty"), null)
})

test("a zero-H1 setting that misses real slang is not called the safest", () => {
  const row = (model: string, h1: [number, number], recall: [number, number]): SweepRow => ({
    setting: { model, temperature: 0 },
    runs: 1,
    hallucinationRate: rate(...h1),
    hallucinationRange: null,
    precision: rate(0, 0),
    recall: rate(...recall),
    falseAcceptRate: rate(0, 0),
    sensitivityMislabelRate: rate(0, 0),
    errors: 0,
    calls: 10,
    reliable: true,
    costPer1000CallsUsd: 0,
    meanLatencyMs: 1000,
    acceptable: false,
    auc: null,
    roc: [],
  })
  const picks = recommend([row("says-no", [0, 10], [1, 20]), row("useful", [3, 10], [15, 20])], { maxH1: 0.1, minRecall: 0.5 })
  assert.equal(picks.find((p) => p.title.startsWith("Safest"))?.setting.model, "useful")
})

test("every model is paired with every temperature", () => {
  const settings = sweepSettings({ models: ["a", "b"], temperatures: [0, 0.7, 1.3] })
  assert.equal(settings.length, 6)
  assert.deepEqual(settings[0], { model: "a", temperature: 0 })
  assert.deepEqual(settings[5], { model: "b", temperature: 1.3 })
})

test("each run gets its setting and seed + repeat, and the environment is restored", async () => {
  const before = { model: process.env.LLM_MODEL, temperature: process.env.LLM_TEMPERATURE }
  process.env.LLM_SEED = "42"
  try {
    const seen = await withDiscoverySetting({ model: "m", temperature: 1.3 }, 2, async () => ({
      model: process.env.LLM_MODEL,
      temperature: process.env.LLM_TEMPERATURE,
      seed: process.env.LLM_SEED,
    }))
    assert.deepEqual(seen, { model: "m", temperature: "1.3", seed: "44" })
    assert.equal(process.env.LLM_SEED, "42")
    assert.equal(process.env.LLM_MODEL, before.model)
    assert.equal(process.env.LLM_TEMPERATURE, before.temperature)
  } finally {
    delete process.env.LLM_SEED
  }
  await assert.rejects(withDiscoverySetting({ model: "m", temperature: 0 }, 0, async () => Promise.reject(new Error("boom"))))
  assert.equal(process.env.LLM_MODEL, before.model, "restored even when the run fails")
})

test("rates are pooled over repeats and the cheapest acceptable setting is recommended", async () => {
  const summary = summariseSweep(await sweep(["big", "small"], [0, 1.3]), { maxH1: 0.1, minRecall: 0.5 })
  assert.equal(summary.rows.length, 4)
  const row = (model: string, temperature: number) =>
    summary.rows.find((r) => r.setting.model === model && r.setting.temperature === temperature)!

  const bigHot = row("big", 1.3)
  assert.equal(bigHot.runs, 2)
  assert.deepEqual([bigHot.hallucinationRate.numerator, bigHot.hallucinationRate.denominator], [6, 8])
  assert.deepEqual(bigHot.hallucinationRange, [0.75, 0.75])
  assert.equal(bigHot.acceptable, false)
  assert.deepEqual([row("small", 1.3).hallucinationRate.numerator, row("small", 1.3).hallucinationRate.denominator], [8, 8])

  assert.equal(row("big", 0).acceptable, true)
  assert.equal(row("small", 0).acceptable, true)
  // Both cold settings pass; small is free, so it wins on cost.
  assert.deepEqual(summary.recommended?.setting, { model: "small", temperature: 0 })
  assert.equal(summary.closest, null)
})

test("when nothing passes, the summary says so and names the closest setting", async () => {
  const summary = summariseSweep(await sweep(["big", "small"], [1.3]), { maxH1: 0.1, minRecall: 0.5 })
  assert.equal(summary.recommended, null)
  assert.deepEqual(summary.closest?.setting, { model: "big", temperature: 1.3 } satisfies SweepSetting)
  const meta = { datasetVersion: "9.9.9", datasetSha256: "abcdef0123456789", startedAt: "2026-11-01T00:00:00.000Z", promptVersion: "p", mock: false }
  const markdown = sweepMarkdown(meta, summary)
  assert.match(markdown, /No setting meets the rule\. Closest: \*\*big @ 1\.3\*\*/)
  assert.match(markdown, /H1 ≤ 10\.0% and recall ≥ 50\.0%/)
  assert.match(markdown, /absolute rates will not transfer/)
  assert.match(sweepMarkdown({ ...meta, mock: true }, summary), /^# Settings sweep: MOCK model/)
  assert.match(sweepMarkdown({ ...meta, mock: true }, summary), /\| mock, as big @ 1\.3 \|/)
})

test("the sweep report keeps every answer so real outputs can be labelled", async () => {
  const runs = await sweep(["big"], [1.3], 1)
  const summary = summariseSweep(runs, { maxH1: 0.1, minRecall: 0.5 })
  const dir = mkdtempSync(path.join(tmpdir(), "sweep-"))
  try {
    const meta = { datasetVersion: "9.9.9", datasetSha256: "abcdef0123456789", startedAt: "2026-11-01T00:00:00.000Z", promptVersion: "p", mock: false }
    const written = writeSweepReport(dir, meta, summary, runs)
    assert.equal(path.basename(written.json), "2026-11-01T00-00-00-000-sweep-big.json")
    const saved = JSON.parse(readFileSync(written.json, "utf8"))
    const fake1 = saved.runs[0].discovery.results.find((r: { id: string }) => r.id === "fake-1")
    assert.equal(fake1.definition, "meaning of fake-1")
    assert.equal(fake1.outcome, "false_positive")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// Like sweep(), but `failing` models throw on every call except the first
// `answered` words (a dropped connection, a rejected parameter).
async function flakySweep(failing: Record<string, number>): Promise<SweepRun[]> {
  const runs = await sweep(["big", "small"], [0], 1)
  for (const run of runs) {
    const answered = failing[run.setting.model]
    if (answered === undefined) continue
    let seen = 0
    run.discovery = await evaluateDiscovery(cases, async (input) => {
      if (seen++ >= answered) throw new Error("Cannot connect to API")
      return fakeModel(input)
    })
  }
  return runs
}

test("a setting with too many errors is shown but never recommended", async () => {
  // small@0 answers 1 of 8 words. Errors are left out of the rates, so on its
  // one answer it looks perfect and free, and would win without the guard.
  const summary = summariseSweep(await flakySweep({ small: 1 }), { maxH1: 0.1, minRecall: 0.5 })
  const small = summary.rows.find((r) => r.setting.model === "small")!
  assert.deepEqual([small.errors, small.calls, small.reliable, small.acceptable], [7, 8, false, false])
  assert.equal(summary.rows.find((r) => r.setting.model === "big")!.reliable, true)
  assert.deepEqual(summary.recommended?.setting, { model: "big", temperature: 0 })
  assert.ok(summary.recommendations.every((r) => r.setting.model === "big"), "no pick or warning rests on 1 answer")
  const markdown = sweepMarkdown(
    { datasetVersion: "9.9.9", datasetSha256: "abcdef0123456789", startedAt: "2026-11-01T00:00:00.000Z", promptVersion: "p", mock: false },
    summary,
  )
  assert.match(markdown, /\| 7 of 8 ⚠ \|/)
  assert.match(markdown, /Left out of every recommendation.*: small @ 0\. Rerun these/)
  assert.match(markdown, /no more than 10\.0% of calls failed/)
  // A looser limit lets it back in.
  assert.equal(summariseSweep(await flakySweep({ small: 1 }), { maxH1: 0.1, minRecall: 0.5, maxErrorRate: 0.9 }).rows[1].reliable, true)
})

test("--combine keeps each model's runs from the last report that has it", async () => {
  const base = { datasetVersion: "9.9.9", datasetSha256: "abcdef0123456789", promptVersion: "p", mock: false, split: "dev" }
  const broken = await flakySweep({ small: 0 })
  const rerun = await sweep(["small"], [0], 1)
  const { meta, runs } = combineSweeps(
    [
      { ...base, file: "first.json", startedAt: "2026-11-01T00:00:00.000Z", runs: broken },
      { ...base, file: "rerun.json", startedAt: "2026-11-02T00:00:00.000Z", runs: rerun },
    ],
    "2026-11-03T00:00:00.000Z",
  )
  assert.deepEqual(runs.map((r) => r.setting.model), ["big", "small"])
  assert.equal(runs[1], rerun[0], "the rerun replaces the broken small rows")
  assert.deepEqual(meta.combinedFrom, [
    { file: "first.json", models: ["big"] },
    { file: "rerun.json", models: ["small"] },
  ])
  const summary = summariseSweep(runs, { maxH1: 0.1, minRecall: 0.5 })
  assert.ok(summary.rows.every((r) => r.reliable && r.errors === 0))
  assert.match(sweepMarkdown(meta, summary), /Combined from 2 sweep reports.*`first\.json` \(big\); `rerun\.json` \(small\)/)
  const dir = mkdtempSync(path.join(tmpdir(), "combine-"))
  try {
    assert.equal(path.basename(writeSweepReport(dir, meta, summary, runs).json), "2026-11-03T00-00-00-000-sweep-combined-big+small.json")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("--combine refuses reports that asked different words", async () => {
  const runs = await sweep(["big"], [0], 1)
  const one = { file: "a.json", datasetVersion: "1", datasetSha256: "aaaaaaaaaaaaaaaa", startedAt: "t", promptVersion: "p", mock: false, split: "dev", runs }
  assert.throws(() => combineSweeps([one, { ...one, file: "b.json", split: "held-out" }], "t"), /different split \(held-out vs dev\)/)
  assert.throws(() => combineSweeps([one, { ...one, file: "b.json", datasetSha256: "bbbbbbbbbbbbbbbb" }], "t"), /different golden set/)
  assert.throws(() => combineSweeps([], "t"), /needs at least one sweep report/)
})
