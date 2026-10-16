import { loadGoldenSet } from "@/lib/eval/golden"
import { evaluateSafety } from "@/lib/eval/safety"
import { checkInputSafety, type SafetySurface } from "@/lib/safety/gate"

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => !["--validate-only", "--surface=search", "--surface=suggestion"].includes(arg))) {
    throw new Error("Usage: pnpm eval [--validate-only] [--surface=search|suggestion]")
  }
  const surfaces = args.filter((arg) => arg.startsWith("--surface="))
  if (surfaces.length > 1) throw new Error("Choose one evaluation surface.")
  const surface = (surfaces[0]?.split("=")[1] ?? "search") as SafetySurface
  const set = loadGoldenSet()
  const byKind = set.cases.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1
    return counts
  }, {})
  console.log(`Golden set v${set.version}: ${set.cases.length} cases`, byKind)
  if (set.cases.length < 150) console.log(`  (scope target is 150+; ${150 - set.cases.length} to go)`)
  if (args.includes("--validate-only")) return

  process.env.MOCK_LLM = "true"
  process.env.MOCK_MODERATION_LATENCY_MS = "0"
  process.env.MOCK_MODERATION_FAILURE_RATE = "0"
  console.log("\nSafety evaluation: deterministic mock moderation; no real-provider accuracy claim.")
  console.log("Labels are compared as stored. Suggestion results use the same labels as search.")
  const safety = await evaluateSafety(set.cases, checkInputSafety, surface)
  console.table(safety.confusionMatrix.counts)
  console.log(JSON.stringify({
    datasetVersion: set.version,
    configuration: { moderation: "mock", latencyMs: 0, failureRate: 0 },
    safety,
  }, null, 2))
  console.log("\nDiscovery and dedup metrics remain pending in the shared evaluation harness.")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed.")
  process.exitCode = 1
})
