import "./setup"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { formatDuration, meterDiscovery, PLANNED_SWEEP_CALLS, pricingFor, projectRunTime, runTiming, summariseCost } from "@/lib/eval/cost"
import { evaluateDiscovery } from "@/lib/eval/discovery"
import { type GoldenCase, splitFor } from "@/lib/eval/golden"
import { callLog, type RunMeta, reportBaseName, toMarkdown, writeReport } from "@/lib/eval/report"

const safe = { action: "safe" as const, categories: [] }
const discovery = (id: string, input: string, isRealSlang: boolean): GoldenCase => ({
  id,
  input,
  source: "test",
  kind: "discovery",
  category: isRealSlang ? "valid_slang" : "invented",
  safety: safe,
  discovery: { isRealSlang, wordType: isRealSlang ? "real-new" : "invented-plausible", split: splitFor(id), dialect: "US" },
})

// rizz is accepted with provider token counts, vemble is rejected, downone
// fails, and the safety case must never reach the model or the log.
const cases: GoldenCase[] = [
  discovery("d-1", "rizz", true),
  discovery("d-2", "vemble", false),
  discovery("d-3", "downone", false),
  {
    id: "safety-x",
    input: "SYNTHETIC-SAFETY-INPUT",
    source: "test",
    kind: "safety",
    category: "safeguarding",
    safety: { action: "safeguarding", crisis: "self_harm", categories: ["suicide_self_harm"] },
  },
]

let clock = 0
const now = () => (clock += 1500)

async function run() {
  clock = 0
  const meter = meterDiscovery(async ({ searchTerm }, onUsage) => {
    if (searchTerm === "downone") throw new Error("Simulated AI provider failure")
    if (searchTerm === "rizz") {
      onUsage?.({ promptTokens: 210, completionTokens: 40 })
      return { isLegit: true, definition: "charm or charisma", sensitivityRating: "Generally Harmless" }
    }
    return { isLegit: false }
  })
  const result = await evaluateDiscovery(cases, meter.generate, { now })
  const config = { mock: false, model: "llama3.2:3b", baseURL: "http://localhost:11434/v1" }
  const meta: RunMeta = {
    datasetVersion: "9.9.9",
    datasetFile: "eval/golden-set.json",
    datasetSha256: "abcdef0123456789",
    startedAt: "2026-11-01T00:00:00.000Z",
    config: { ...config, promptVersion: "prod-2026-09-27", temperature: 0.7, seed: 42 },
    timing: runTiming(0, 4500, result.calls),
    cost: summariseCost(meter.calls, pricingFor(config, {})),
  }
  return { meter, result, meta }
}

test("the run log has one line per call with case id, settings, answer, seconds and tokens", async () => {
  const { meter, result, meta } = await run()
  const lines = callLog(meta, result, meter.calls)
  assert.equal(lines.length, 3, "one line per discovery case; the safety case is never called")
  assert.deepEqual(lines[0], {
    caseId: "d-1",
    model: "llama3.2:3b",
    temperature: 0.7,
    seed: 42,
    promptVersion: "prod-2026-09-27",
    accepted: true,
    definition: "charm or charisma",
    rating: "Generally Harmless",
    error: null,
    seconds: 1.5,
    promptTokens: 210,
    completionTokens: 40,
    tokenSource: "provider",
  })
  assert.equal(lines[1].accepted, false)
  assert.equal(lines[1].tokenSource, "estimate")
  assert.equal(lines[2].error, "Simulated AI provider failure")
  assert.equal(lines[2].promptTokens, null, "a failed call has no token count")
})

test("the run log file never holds safety-case text or inputs", async () => {
  const { meter, result, meta } = await run()
  const dir = mkdtempSync(path.join(tmpdir(), "run-log-"))
  try {
    const written = writeReport(dir, meta, result, meter.calls)
    assert.equal(path.basename(written.log), "2026-11-01T00-00-00-000-discovery-llama3.2_3b.calls.jsonl")
    const text = readFileSync(written.log, "utf8")
    assert.equal(text.trim().split("\n").length, 3)
    assert.ok(!text.includes("SYNTHETIC-SAFETY-INPUT"))
    assert.ok(!text.includes('"vemble"'), "the log carries case ids, not inputs")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the report header shows time and cost, and a timing test says so", async () => {
  const { result, meta } = await run()
  const header = toMarkdown(meta, result).split("\n\n")[1]
  assert.match(header, /- Time and cost: 4\.5 s for 2 calls \(40 per minute\); \$0 for the run, \$0 per 1,000 calls \(local server/)
  const limited = { ...meta, caseLimit: 20 }
  assert.equal(reportBaseName(limited), "2026-11-01T00-00-00-000-discovery-llama3.2_3b-first20")
  assert.match(toMarkdown(limited, result), /- Timing test: first 20 discovery cases only/)
})

test("a 20-call timing test projects the time of a bigger run", () => {
  // 20 calls in 2 minutes = 6 s per call; 4,100 calls = 24,600 s = 6.8 h.
  const timing = runTiming(0, 120_000, 20)
  assert.equal(projectRunTime(timing, 20, 1), 6000)
  assert.equal(formatDuration(projectRunTime(timing, 20, 1)), "6.0 s")
  assert.equal(formatDuration(projectRunTime(timing, 20, 1000)), "1.7 h")
  assert.equal(formatDuration(projectRunTime(timing, 20, PLANNED_SWEEP_CALLS)), "6.8 h")
  assert.equal(formatDuration(projectRunTime(timing, 20, 10)), "1.0 min")
  assert.equal(projectRunTime(timing, 0, 1000), null)
  assert.equal(formatDuration(null), "unknown")
})
