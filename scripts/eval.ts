// Evaluation harness entry point: `pnpm eval` (team-owned; Sprint 2).
//
// Shipped: golden-set loading and validation (`pnpm eval:validate`), and
// discovery over every "discovery" case (lib/eval/discovery.ts) with the mock
// model (default) or a real model (MOCK_LLM=false); `--report` writes a JSON
// and Markdown report to eval/reports/. `--sweep` runs every model ×
// temperature with repeats and writes the results grid (lib/eval/sweep.ts).
// Still to build, per the approved scope:
// - run the safety gate (lib/safety/gate.ts) over every "safety" case;
// - run normalisation (lib/normalise) over every "dedup" case;
// - report precision, recall, hallucination rate, sensitivity mislabels,
//   gate agreement (crisis recall must be 100%), merge precision/recall,
//   latency and cost per run (done: lib/eval/cost.ts) — as a table in the terminal plus a JSON/Markdown
//   report you can commit (never include raw safety-case inputs in shared
//   reports beyond the case id).
// - stretch: compare two prompt versions side by side.
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { discoveryModelConfig, generateDiscoveryObject } from "@/lib/_stubs/llm"
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
import { DISCOVERY_PROMPT_VERSION } from "@/lib/discovery/prompt"
import { evaluateDiscovery } from "@/lib/eval/discovery"
import { DEFAULT_GOLDEN_SET_PATH, EVAL_CATEGORIES, type GoldenSet, loadGoldenSet, SPLITS, type Split } from "@/lib/eval/golden"
import { formatRate } from "@/lib/eval/metrics"
import { type RunMeta, sha256File, writeReport } from "@/lib/eval/report"
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
const byKind = set.cases.reduce<Record<string, number>>((acc, c) => {
  acc[c.kind] = (acc[c.kind] ?? 0) + 1
  return acc
}, {})
console.log(`Golden set v${set.version}: ${set.cases.length} cases`, byKind)
if (set.cases.length < 150) console.log(`  (scope target is 150+; ${150 - set.cases.length} to go)`)

const byCategory = Object.fromEntries(EVAL_CATEGORIES.map((category) => [category, 0]))
for (const c of set.cases) if (c.kind !== "dedup") byCategory[c.category]++
console.log("By category:", byCategory)
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

//Reviewer section
  const review = set.review;
  console.log(
    review
      ? `Second review: v${review.version} by ${review.reviewer} on ${review.reviewedOn}; ${review.disagreements.length} disagreements (${review.disagreements.filter(d => d.status === "flagged").length} still flagged)`
      : "Second review: not yet reviewed!"
  );
  if (review && review.version !== set.version) {
    console.log(
      `(review is for v${review.version}; the set is now v${set.version})`
    );
  }

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
    const at = (calls: number) => formatDuration(projectRunTime(timing, discovery.calls, calls))
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
  console.log("\nStill to come: the real-model sweep results (W18EDATE-66), dedup metrics.")
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

if (flagCombine >= 0) {
  try {
    runCombine()
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Combine failed.")
    process.exitCode = 1
  }
} else if (!validateOnly) {

  process.env.MOCK_LLM_LATENCY_MS ??= "0"
  process.env.MOCK_LLM_FAILURE_RATE ??= "0"
  ;(sweep ? runSweep() : runDiscovery()).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Evaluation failed.")
    process.exitCode = 1
  })
}
