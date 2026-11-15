import { EVAL_CATEGORIES, loadGoldenSet } from "@/lib/eval/golden"
import { evaluateOutputSafety } from "@/lib/eval/output-safety"
import { moderate } from "@/lib/_stubs/moderation"
import { evaluateSafety } from "@/lib/eval/safety"
import { checkInputSafety, type SafetySurface } from "@/lib/safety/gate"

async function main() {
  const args = process.argv.slice(2)
  const usage = "Usage: pnpm eval [--validate-only] [--file <path>] [--surface=search|suggestion]"
  let file: string | undefined
  let surface: SafetySurface = "search"
  let selectedSurface = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--validate-only") continue
    if (arg === "--file") {
      if (file !== undefined || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(usage)
      file = args[++i]
    } else if (arg === "--surface=search" || arg === "--surface=suggestion") {
      if (selectedSurface) throw new Error("Choose one evaluation surface.")
      selectedSurface = true
      surface = arg === "--surface=search" ? "search" : "suggestion"
    } else {
      throw new Error(usage)
    }
  }
  const set = loadGoldenSet(file)
  const outputCases = set.outputSafetyCases ?? []
  const byKind = set.cases.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1
    return counts
  }, {})
  console.log(`Golden set v${set.version}: ${set.cases.length} cases`, byKind)
  if (set.cases.length < 150) console.log(`  (scope target is 150+; ${150 - set.cases.length} to go)`)
  const byCategory = Object.fromEntries(EVAL_CATEGORIES.map(category => [category, 0]))
  for (const entry of set.cases) if (entry.kind !== "dedup") byCategory[entry.category]++
  console.log("By category:", byCategory)
  console.log(`Output safety fixtures: ${outputCases.length}`)
  const empty = EVAL_CATEGORIES.filter(category => byCategory[category] === 0)
  if (empty.length) console.log(`  (no cases yet for: ${empty.join(", ")})`)
  const review = set.review
  console.log(review
    ? `Second review: v${review.version} by ${review.reviewer} on ${review.reviewedOn}; ${review.disagreements.length} disagreements (${review.disagreements.filter(d => d.status === "flagged").length} still flagged)`
    : "Second review: not yet reviewed!")
  if (review && review.version !== set.version) console.log(`(review is for v${review.version}; the set is now v${set.version})`)
  if (args.includes("--validate-only")) return

  process.env.MOCK_LLM = "true"
  process.env.MOCK_MODERATION_LATENCY_MS = "0"
  process.env.MOCK_MODERATION_FAILURE_RATE = "0"
  console.log("\nSafety evaluation: deterministic mock moderation; no real-provider accuracy claim.")
  console.log("Surface-specific labels apply only to that surface. For suggestions, shared safe lookup labels with sensitive categories expect refusal.")
  const safety = await evaluateSafety(set.cases, checkInputSafety, surface)
  console.table(safety.confusionMatrix.counts)
  const outputSafety = await evaluateOutputSafety(outputCases, checkInputSafety, moderate)
  console.log("Output safety checks exercise generated and cached search results with injected fixtures.")
  console.log(JSON.stringify({
    datasetVersion: set.version,
    configuration: { moderation: "mock", latencyMs: 0, failureRate: 0 },
    safety,
    outputSafety,
  }, null, 2))
  console.log("\nDiscovery and dedup metrics remain pending in the shared evaluation harness.")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed.")
  process.exitCode = 1
})
