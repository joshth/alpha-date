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
import {
  DEFAULT_TEMPERATURES,
  parseSweepArgs,
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
  assert.deepEqual(defaults, { models: ["llama3.2:3b"], temperatures: DEFAULT_TEMPERATURES, repeats: 3, maxH1: 0.1, minRecall: 0.5 })
  const custom = parseSweepArgs(
    ["--sweep", "--models", "a, b", "--temperatures", "0,1.3", "--repeats", "3", "--max-h1", "0.05", "--min-recall", "0.6"],
    "x",
  )
  assert.deepEqual(custom, { models: ["a", "b"], temperatures: [0, 1.3], repeats: 3, maxH1: 0.05, minRecall: 0.6 })
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
