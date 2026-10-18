// Evaluation harness entry point: `pnpm eval` (team-owned; Sprint 2).
//
// Shipped: golden-set loading and validation (`pnpm eval:validate`), and
// discovery over every "discovery" case (lib/eval/discovery.ts) with the mock
// model (default) or a real model (MOCK_LLM=false); `--report` writes a JSON
// and Markdown report to eval/reports/.
// Still to build, per the approved scope:
// - run the safety gate (lib/safety/gate.ts) over every "safety" case;
// - run normalisation (lib/normalise) over every "dedup" case;
// - report precision, recall, hallucination rate, sensitivity mislabels,
//   gate agreement (crisis recall must be 100%), merge precision/recall,
//   latency and cost per run — as a table in the terminal plus a JSON/Markdown
//   report you can commit (never include raw safety-case inputs in shared
//   reports beyond the case id).
// - stretch: compare two prompt versions side by side.
import path from "node:path"
import { discoveryModelConfig, generateDiscoveryObject } from "@/lib/_stubs/llm"
import { DISCOVERY_PROMPT_VERSION } from "@/lib/discovery/prompt"
import { evaluateDiscovery } from "@/lib/eval/discovery"
import { DEFAULT_GOLDEN_SET_PATH, EVAL_CATEGORIES, type GoldenSet, loadGoldenSet } from "@/lib/eval/golden"
import { formatRate } from "@/lib/eval/metrics"
import { type RunMeta, sha256File, writeReport } from "@/lib/eval/report"

const validateOnly = process.argv.includes("--validate-only")
const writeReportFiles = process.argv.includes("--report")

const flagFile = process.argv.indexOf("--file")
const file = flagFile >= 0 && process.argv[flagFile + 1] ? process.argv[flagFile + 1] : DEFAULT_GOLDEN_SET_PATH

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

async function runDiscovery() {
  // The mock's simulated latency and outages are opt-in here, so a plain
  // `pnpm eval` is fast and repeatable; set them explicitly to test outages.
  process.env.MOCK_LLM_LATENCY_MS ??= "0"
  process.env.MOCK_LLM_FAILURE_RATE ??= "0"

  const meta: RunMeta = {
    datasetVersion: set.version,
    datasetFile: path.relative(process.cwd(), file),
    datasetSha256: sha256File(file),
    startedAt: new Date().toISOString(),
    config: { ...discoveryModelConfig(), promptVersion: DISCOVERY_PROMPT_VERSION },
  }
  console.log(
    `\nDiscovery evaluation: ${meta.config.mock ? "MOCK model, deterministic; not a real accuracy claim" : meta.config.model}` +
      ` (prompt ${meta.config.promptVersion})`,
  )
  const discovery = await evaluateDiscovery(set.cases, generateDiscoveryObject)
  console.table({
    "model accepted": { "real slang": discovery.confusion.truePositive, "not slang": discovery.confusion.falsePositive },
    "model rejected": { "real slang": discovery.confusion.falseNegative, "not slang": discovery.confusion.trueNegative },
  })
  console.log(`Precision:             ${formatRate(discovery.precision)}`)
  console.log(`Recall:                ${formatRate(discovery.recall)}`)
  console.log(`H1 hallucination rate: ${formatRate(discovery.hallucinationRate)}  [${discovery.hallucinatedIds.join(", ")}]`)
  console.log(`False-accept rate:     ${formatRate(discovery.falseAcceptRate)}`)
  console.log(`Sensitivity mislabels: ${formatRate(discovery.sensitivityMislabelRate)}  [${discovery.sensitivityMislabelIds.join(", ")}]`)
  console.log(`Calls: ${discovery.calls}; provider errors: ${discovery.errorIds.length}; mean latency ${discovery.latency.meanMs?.toFixed(1)} ms`)

  if (writeReportFiles) {
    const written = writeReport(path.join(process.cwd(), "eval", "reports"), meta, discovery)
    console.log(`\nReport written: ${path.relative(process.cwd(), written.json)} and ${path.relative(process.cwd(), written.markdown)}`)
  }
  console.log("\nStill to come (Sprint 2): settings sweep (W18EDATE-66), cost per run (W18EDATE-69), dedup metrics.")
}

if (!validateOnly) {
  runDiscovery().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Evaluation failed.")
    process.exitCode = 1
  })
}
