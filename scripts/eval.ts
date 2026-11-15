// Evaluation harness entry point: `pnpm eval` (team-owned).
//
// One command, three parts:
// - discovery (Jai, scope 2): every "discovery" case through the discovery
//   model, mock by default or real with MOCK_LLM=false (lib/eval/discovery.ts).
//   `--report` writes JSON, Markdown and a per-call log to eval/reports/;
//   `--sweep` runs every model × temperature with repeats (lib/eval/sweep.ts);
//   `--combine a.json,b.json` merges saved sweeps into one report.
// - safety (Rishabh, W18EDATE-35, W18EDATE-46): the input gate over every
//   "safety" case and the output checks over the output fixtures, always with
//   deterministic mock moderation (lib/eval/safety.ts, lib/eval/output-safety.ts).
// - dedup: still to come.
// Plain `pnpm eval` (as CI runs it) does discovery with the mock, then safety.
// `--sweep` and `--combine` compare discovery models only.
// Shared reports never include raw safety-case inputs, only case ids.
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { discoveryModelConfig, generateDiscoveryObject } from "@/lib/_stubs/llm"
import { moderate } from "@/lib/_stubs/moderation"
import { DISCOVERY_PROMPT_VERSION } from "@/lib/discovery/prompt"
import {
  formatDuration,
  formatUsd,
  meterDiscovery,
  PLANNED_SWEEP_CALLS,
  pricingFor,
  projectRunTime,
  runTiming,
  summariseCost,
} from "@/lib/eval/cost"
import { evaluateDiscovery } from "@/lib/eval/discovery"
import { DEFAULT_GOLDEN_SET_PATH, EVAL_CATEGORIES, type GoldenSet, loadGoldenSet, SPLITS, type Split } from "@/lib/eval/golden"
import { formatRate } from "@/lib/eval/metrics"
import { evaluateOutputSafety } from "@/lib/eval/output-safety"
import { type RunMeta, sha256File, writeReport } from "@/lib/eval/report"
import { evaluateSafety } from "@/lib/eval/safety"
import {
  combineSweeps,
  parseSweepArgs,
  type SavedSweep,
  type SweepRun,
  summariseSweep,
  sweepSettings,
  withDiscoverySetting,
  writeSweepReport,
} from "@/lib/eval/sweep"
import { checkInputSafety, type SafetySurface } from "@/lib/safety/gate"

// Every flag is checked before anything runs: an unknown flag, a missing value
// or two surfaces stops with the usage line.
const USAGE =
  "Usage: pnpm eval [--validate-only] [--file <path>] [--surface=search|suggestion] [--report] [--limit <n>] [--split dev|held-out] " +
  "[--sweep --models <a,b> --temperatures <t,t> --repeats <n> --max-h1 <x> --min-recall <x> --max-error-rate <x>] [--combine <a.json,b.json>]"
const SWITCHES = new Set(["--validate-only", "--report", "--sweep"])
const VALUE_FLAGS = new Set([
  "--file",
  "--limit",
  "--split",
  "--models",
  "--temperatures",
  "--repeats",
  "--max-h1",
  "--min-recall",
  "--max-error-rate",
  "--combine",
])

function checkFlags(args: readonly string[]): SafetySurface {
  let surface: SafetySurface = "search"
  let selectedSurface = false
  const seen = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--surface=search" || arg === "--surface=suggestion") {
      if (selectedSurface) throw new Error("Choose one evaluation surface.")
      selectedSurface = true
      surface = arg === "--surface=search" ? "search" : "suggestion"
    } else if (SWITCHES.has(arg)) {
      continue
    } else if (VALUE_FLAGS.has(arg)) {
      if (seen.has(arg) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(USAGE)
      seen.add(arg)
      i++
    } else {
      throw new Error(USAGE)
    }
  }
  return surface
}

let surface: SafetySurface
try {
  surface = checkFlags(process.argv.slice(2))
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

const validateOnly = process.argv.includes("--validate-only")
const writeReportFiles = process.argv.includes("--report")
const sweep = process.argv.includes("--sweep")
const flagCombine = process.argv.indexOf("--combine")

const flagFile = process.argv.indexOf("--file")
const file = flagFile >= 0 && process.argv[flagFile + 1] ? process.argv[flagFile + 1] : DEFAULT_GOLDEN_SET_PATH

const flagLimit = process.argv.indexOf("--limit")
const caseLimit = flagLimit >= 0 ? Number(process.argv[flagLimit + 1]) : undefined
if (caseLimit !== undefined && !(Number.isInteger(caseLimit) && caseLimit > 0)) {
  console.error(`--limit must be a whole number above 0, e.g. --limit 20 (got "${process.argv[flagLimit + 1] ?? ""}")`)
  process.exit(1)
}

const flagSplit = process.argv.indexOf("--split")
const onlySplit = flagSplit >= 0 ? (process.argv[flagSplit + 1] as Split | undefined) : undefined
if (flagSplit >= 0 && !SPLITS.includes(onlySplit as Split)) {
  console.error(`--split must be one of ${SPLITS.join(", ")} (got "${process.argv[flagSplit + 1] ?? ""}")`)
  process.exit(1)
}

let set: GoldenSet
try {
  set = loadGoldenSet(file)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
const outputCases = set.outputSafetyCases ?? []
const byKind = set.cases.reduce<Record<string, number>>((acc, c) => {
  acc[c.kind] = (acc[c.kind] ?? 0) + 1
  return acc
}, {})
console.log(`Golden set v${set.version}: ${set.cases.length} cases`, byKind)
if (set.cases.length < 150) console.log(`  (scope target is 150+; ${150 - set.cases.length} to go)`)

const byCategory = Object.fromEntries(EVAL_CATEGORIES.map((category) => [category, 0]))
for (const c of set.cases) if (c.kind !== "dedup") byCategory[c.category]++
console.log("By category:", byCategory)
console.log(`Output safety fixtures: ${outputCases.length}`)
const empty = EVAL_CATEGORIES.filter((category) => byCategory[category] === 0)
if (empty.length) console.log(`  (no cases yet for: ${empty.join(", ")})`)

const discoveryCases = set.cases.flatMap((c) => (c.kind === "discovery" ? [c] : []))
const countBy = (pick: (c: (typeof discoveryCases)[number]) => string) =>
  discoveryCases.reduce<Record<string, number>>((acc, c) => {
    acc[pick(c)] = (acc[pick(c)] ?? 0) + 1
    return acc
  }, {})
console.log("Discovery by word type:", countBy((c) => c.discovery.wordType))
console.log("Discovery by split:", countBy((c) => c.discovery.split), "by dialect:", countBy((c) => c.discovery.dialect))

const review = set.review
console.log(
  review
    ? `Second review: v${review.version} by ${review.reviewer} on ${review.reviewedOn}; ${review.disagreements.length} disagreements ` +
        `(${review.disagreements.filter((d) => d.status === "flagged").length} still flagged)`
    : "Second review: not yet reviewed!",
)
if (review && review.version !== set.version) console.log(`(review is for v${review.version}; the set is now v${set.version})`)

// One discovery run with whatever model settings are in the environment now:
async function runDiscoveryOnce() {
  const meta: RunMeta = {
    datasetVersion: set.version,
    datasetFile: path.relative(process.cwd(), file),
    datasetSha256: sha256File(file),
    startedAt: new Date().toISOString(),
    config: { ...discoveryModelConfig(), promptVersion: DISCOVERY_PROMPT_VERSION },
  }
  const pricing = pricingFor(meta.config)
  const meter = meterDiscovery(generateDiscoveryObject)
  const startedMs = performance.now()
  const pool = discoveryCases.filter((c) => onlySplit === undefined || c.discovery.split === onlySplit)
  const cases = caseLimit ? pool.slice(0, caseLimit) : pool
  if (caseLimit) meta.caseLimit = caseLimit
  if (onlySplit) meta.split = onlySplit
  const discovery = await evaluateDiscovery(cases, meter.generate)
  meta.finishedAt = new Date().toISOString()
  const timing = runTiming(startedMs, performance.now(), discovery.calls)
  const cost = summariseCost(meter.calls, pricing)
  meta.timing = timing
  meta.cost = cost
  return { meta, timing, cost, pricing, discovery, calls: meter.calls }
}

async function runDiscovery() {
  const { meta, timing, cost, pricing, discovery, calls } = await runDiscoveryOnce()
  console.log(
    `\nDiscovery evaluation: ${meta.config.mock ? "MOCK model, deterministic; not a real accuracy claim" : meta.config.model}` +
      ` (prompt ${meta.config.promptVersion}; ${onlySplit ? `${onlySplit} split only` : "all splits"})`,
  )
  console.table({
    "model accepted": { "real slang": discovery.confusion.truePositive, "not slang": discovery.confusion.falsePositive },
    "model rejected": { "real slang": discovery.confusion.falseNegative, "not slang": discovery.confusion.trueNegative },
  })
  console.log(`Precision:             ${formatRate(discovery.precision)}`)
  console.log(`Recall:                ${formatRate(discovery.recall)}`)
  console.log(`H1 hallucination rate: ${formatRate(discovery.hallucinationRate)}  [${discovery.hallucinatedIds.join(", ")}]`)
  console.log(`False-accept rate:     ${formatRate(discovery.falseAcceptRate)}`)
  console.log(`Sensitivity mislabels: ${formatRate(discovery.sensitivityMislabelRate)}  [${discovery.sensitivityMislabelIds.join(", ")}]`)
  for (const [title, groups] of [
    ["word type", discovery.byWordType],
    ["dialect", discovery.byDialect],
    ["split", discovery.bySplit],
  ] as const) {
    console.log(`By ${title}:`)
    for (const [key, g] of Object.entries(groups)) {
      console.log(`  ${key.padEnd(19)} ${String(g.cases).padStart(3)} cases; recall ${formatRate(g.recall)}; H1 ${formatRate(g.hallucinationRate)}`)
    }
  }
  console.log(
    `Calls: ${discovery.calls}; provider errors: ${discovery.errorIds.length}; ` +
      `latency mean ${discovery.latency.meanMs?.toFixed(1)} ms, p95 ${discovery.latency.p95Ms?.toFixed(1)} ms; ` +
      `run took ${(timing.wallClockMs / 1000).toFixed(1)} s`,
  )
  console.log(
    `Tokens (${cost.tokenSource}): ${cost.promptTokens} in + ${cost.completionTokens} out; ` +
      `cost ${formatUsd(cost.costUsd)}, ${formatUsd(cost.costPer1000CallsUsd)} per 1,000 calls ` +
      `(${pricing?.source ?? "no price known; set LLM_PRICE_INPUT_PER_MTOK and LLM_PRICE_OUTPUT_PER_MTOK"})`,
  )

  if (caseLimit) {
    const at = (n: number) => formatDuration(projectRunTime(timing, discovery.calls, n))
    console.log(
      `Timing test (${discovery.calls} calls): ${at(1)} per call, so 1,000 calls take about ${at(1000)} ` +
        `and the planned E0 to E5 sweep (about ${PLANNED_SWEEP_CALLS.toLocaleString("en-AU")} calls) about ${at(PLANNED_SWEEP_CALLS)}`,
    )
  }

  if (writeReportFiles) {
    const written = writeReport(path.join(process.cwd(), "eval", "reports"), meta, discovery, calls)
    const shown = [written.json, written.markdown, written.log].map((f) => path.relative(process.cwd(), f))
    console.log(`\nReport written: ${shown.join(", ")} (the .calls.jsonl file is the one-line-per-call run log)`)
  }
}

// `pnpm eval --sweep`: every model × temperature, `--repeats` times each, then
// the results grid and decision summary. Always writes its report.
async function runSweep() {
  const options = parseSweepArgs(process.argv, discoveryModelConfig().model)
  const settings = sweepSettings(options)
  const startedAt = new Date().toISOString()
  console.log(`\nSweep: ${settings.length} settings × ${options.repeats} repeats = ${settings.length * options.repeats} runs`)
  const runs: SweepRun[] = []
  for (const setting of settings) {
    for (let repeat = 0; repeat < options.repeats; repeat++) {
      const { meta, timing, cost, discovery } = await withDiscoverySetting(setting, repeat, runDiscoveryOnce)
      runs.push({ setting, repeat, config: meta.config, discovery, cost, timing })
      console.log(
        `  ${setting.model} @ ${setting.temperature} #${repeat + 1}: H1 ${formatRate(discovery.hallucinationRate)}; ` +
          `recall ${formatRate(discovery.recall)}; ${(timing.wallClockMs / 1000).toFixed(1)} s`,
      )
    }
  }
  const summary = summariseSweep(runs, options)
  const written = writeSweepReport(
    path.join(process.cwd(), "eval", "reports"),
    {
      datasetVersion: set.version,
      datasetSha256: sha256File(file),
      startedAt,
      promptVersion: DISCOVERY_PROMPT_VERSION,
      mock: runs.every((r) => r.config.mock),
      ...(onlySplit ? { split: onlySplit } : {}),
    },
    summary,
    runs,
  )
  console.log(`\n${written.markdownText}`)
  const files = [written.json, written.markdown, written.roc].filter((f): f is string => f !== null)
  console.log(`Report written: ${files.map((f) => path.relative(process.cwd(), f)).join(", ")}`)
}

// `pnpm eval --combine a.json,b.json`: merge saved sweeps into one report
// (lib/eval/sweep.ts combineSweeps). Makes no model calls.
function runCombine() {
  const names = (process.argv[flagCombine + 1] ?? "").split(",").map((f) => f.trim()).filter(Boolean)
  const reports = path.join(process.cwd(), "eval", "reports")
  const saved: SavedSweep[] = names.map((name) => {
    const full = [name, path.join(reports, name)].find((f) => existsSync(f))
    if (!full) throw new Error(`--combine: no such report: ${name}`)
    return { ...JSON.parse(readFileSync(full, "utf8")), file: path.basename(full) }
  })
  const { meta, runs } = combineSweeps(saved, new Date().toISOString())
  const summary = summariseSweep(runs, parseSweepArgs(process.argv, "unused", {}))
  const written = writeSweepReport(reports, meta, summary, runs)
  console.log(`\n${written.markdownText}`)
  const files = [written.json, written.markdown, written.roc].filter((f): f is string => f !== null)
  console.log(`Report written: ${files.map((f) => path.relative(process.cwd(), f)).join(", ")}`)
}

// Safety evaluation (W18EDATE-35, W18EDATE-46): always mock moderation. The mock
// settings are put back afterwards, so they never switch a real discovery run
// to the mock.
async function runSafety() {
  const keys = ["MOCK_LLM", "MOCK_MODERATION_LATENCY_MS", "MOCK_MODERATION_FAILURE_RATE"] as const
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  process.env.MOCK_LLM = "true"
  process.env.MOCK_MODERATION_LATENCY_MS = "0"
  process.env.MOCK_MODERATION_FAILURE_RATE = "0"
  try {
    console.log("\nSafety evaluation: deterministic mock moderation; no real-provider accuracy claim.")
    console.log(
      "Surface-specific labels apply only to that surface. For suggestions, shared safe lookup labels with sensitive categories expect refusal.",
    )
    const safety = await evaluateSafety(set.cases, checkInputSafety, surface)
    console.table(safety.confusionMatrix.counts)
    const outputSafety = await evaluateOutputSafety(outputCases, checkInputSafety, moderate)
    console.log("Output safety checks exercise generated and cached search results with injected fixtures.")
    console.log(
      JSON.stringify(
        { datasetVersion: set.version, configuration: { moderation: "mock", latencyMs: 0, failureRate: 0 }, safety, outputSafety },
        null,
        2,
      ),
    )
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

async function main() {
  if (validateOnly) return
  if (flagCombine >= 0) return runCombine()
  process.env.MOCK_LLM_LATENCY_MS ??= "0"
  process.env.MOCK_LLM_FAILURE_RATE ??= "0"
  if (sweep) return runSweep()
  await runDiscovery()
  await runSafety()
  console.log("\nDedup metrics remain pending in the shared evaluation harness.")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed.")
  process.exitCode = 1
})
