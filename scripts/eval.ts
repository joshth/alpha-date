// Evaluation harness entry point: `pnpm eval` (team-owned; Sprint 2).
//
// Shipped: golden-set loading and validation (`pnpm eval:validate`).
// To build, per the approved scope:
// - run discovery (lib/discovery/discover.ts) over every "discovery" case with
//   the mock model (default) and optionally a real model (MOCK_LLM=false);
// - run the safety gate (lib/safety/gate.ts) over every "safety" case;
// - run normalisation (lib/normalise) over every "dedup" case;
// - report precision, recall, hallucination rate, sensitivity mislabels,
//   gate agreement (crisis recall must be 100%), merge precision/recall,
//   latency and cost per run — as a table in the terminal plus a JSON/Markdown
//   report you can commit (never include raw safety-case inputs in shared
//   reports beyond the case id).
// - stretch: compare two prompt versions side by side.
import { loadGoldenSet } from "@/lib/eval/golden"

const validateOnly = process.argv.includes("--validate-only")

const set = loadGoldenSet()
const byKind = set.cases.reduce<Record<string, number>>((acc, c) => {
  acc[c.kind] = (acc[c.kind] ?? 0) + 1
  return acc
}, {})
console.log(`Golden set v${set.version}: ${set.cases.length} cases`, byKind)
if (set.cases.length < 150) console.log(`  (scope target is 150+; ${150 - set.cases.length} to go)`)

if (!validateOnly) {
  console.log("\nMetrics not implemented yet — see the comment at the top of scripts/eval.ts (Sprint 2).")
}
