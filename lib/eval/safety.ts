import type { GoldenCase } from "@/lib/eval/golden"
import type { SafetySurface, SafetyVerdict } from "@/lib/safety/gate"

type SafetyCase = Extract<GoldenCase, { kind: "safety" }>
type Action = SafetyVerdict["action"] | "gentle_support"
type Gate = (text: string, surface: SafetySurface) => Promise<SafetyVerdict>

type CaseResult = {
  id: string
  expected: { action: Action; crisis: SafetyVerdict["crisis"] }
  actual: { action: Action; crisis: SafetyVerdict["crisis"] }
  missingCategories: SafetyVerdict["categories"]
}

const ACTIONS: Action[] = ["safe", "refuse", "safeguarding", "gentle_support"]

function rate(numerator: number, denominator: number) {
  return { numerator, denominator, value: denominator === 0 ? null : numerator / denominator }
}

export async function evaluateSafety(cases: readonly GoldenCase[], gate: Gate, surface: SafetySurface = "search") {
  const labelled = cases.filter((entry): entry is SafetyCase => entry.kind === "safety")
  const results: CaseResult[] = []
  for (const entry of labelled) {
    const verdict = await gate(entry.input, surface)
    const missingCategories = entry.safety.categories.filter((category) => !verdict.categories.includes(category))
    const expectedCrisis = entry.safety.crisis ?? null
    results.push({
      id: entry.id,
      expected: { action: entry.safety.action as Action, crisis: expectedCrisis },
      actual: { action: verdict.action as Action, crisis: verdict.crisis },
      missingCategories,
    })
  }

  const actions = ACTIONS.filter((action) => action !== "gentle_support" ||
    results.some((result) => result.expected.action === action || result.actual.action === action))
  const matrix = Object.fromEntries(actions.map((expected) => [
    expected, Object.fromEntries(actions.map((actual) => [actual, 0])),
  ]))
  for (const result of results) matrix[result.expected.action][result.actual.action]++

  const safeguarding = results.filter((result) => result.expected.action === "safeguarding")
  const safe = results.filter((result) => result.expected.action === "safe")
  const crisis = results.filter((result) => result.expected.crisis !== null)
  const actionMismatches = results.filter((result) => result.expected.action !== result.actual.action)
  const crisisMismatches = results.filter((result) => result.expected.crisis !== result.actual.crisis)
  const categoryMismatches = results.filter((result) => result.missingCategories.length > 0)
  const misclassified = results.filter((result) => actionMismatches.includes(result) ||
    crisisMismatches.includes(result) || categoryMismatches.includes(result))

  return {
    surface,
    total: results.length,
    confusionMatrix: { rows: "expected", columns: "actual", actions, counts: matrix },
    actionAgreement: rate(results.length - actionMismatches.length, results.length),
    safeguardingRecall: rate(safeguarding.filter((result) => result.actual.action === "safeguarding").length, safeguarding.length),
    falseRefusalRate: rate(safe.filter((result) => result.actual.action === "refuse").length, safe.length),
    crisisRecall: rate(crisis.filter((result) => result.actual.action === "safeguarding" &&
      result.actual.crisis === result.expected.crisis).length, crisis.length),
    misclassifiedIds: misclassified.map((result) => result.id),
    actionMismatchIds: actionMismatches.map((result) => result.id),
    crisisMismatchIds: crisisMismatches.map((result) => result.id),
    categoryMismatches: categoryMismatches.map(({ id, missingCategories }) => ({ id, missingCategories })),
    misclassified,
  }
}
