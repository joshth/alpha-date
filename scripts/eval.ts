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
import { DEFAULT_GOLDEN_SET_PATH, EVAL_CATEGORIES, type GoldenSet, loadGoldenSet } from "@/lib/eval/golden"

const validateOnly = process.argv.includes("--validate-only")

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

if (!validateOnly) {
  console.log("\nMetrics not implemented yet — see the comment at the top of scripts/eval.ts (Sprint 2).")
}
