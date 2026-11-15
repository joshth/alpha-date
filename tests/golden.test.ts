import "./setup"
import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import { EVAL_CATEGORIES, type GoldenCase, type GoldenSet, labelProblems, loadGoldenSet, reviewProblems } from "@/lib/eval/golden"
import { checkInputSafety } from "@/lib/safety/gate"
import f11Expectations from "./fixtures/f1-1-safety-expectations.json"

const golden = loadGoldenSet()
// Keep the starter answer key unchanged while testing the newer F1.1 policy.
const currentExpectations: Record<string, {
  input: string; baselineAction: string; action: string; reason: string; requirement: string
}> = f11Expectations

test("F1.1 policy changes refer to the unchanged starter input and label", () => {
  for (const [id, expected] of Object.entries(currentExpectations)) {
    const entry = golden.cases.find(c => c.id === id)
    assert.ok(entry && entry.kind === "discovery", id)
    assert.equal(entry.input, expected.input)
    assert.equal(entry.safety.action, expected.baselineAction)
    assert.equal(expected.requirement, "W18EDATE-146")
  }
})

test("every safety and discovery case has a consistent evaluation category", () => {
  for (const c of golden.cases) {
    if (c.kind === "dedup") continue
    assert.ok(EVAL_CATEGORIES.includes(c.category), c.id)
    assert.deepEqual(labelProblems(c), [], c.id)
  }
})

test("every evaluation category has at least one case, so canot break", () => {
  for (const category of EVAL_CATEGORIES) {
    assert.ok(
      golden.cases.some((c) => c.kind !== "dedup" && c.category === category),
      `no cases for category ${category}`,
    )
  }
})

for (const c of golden.cases) {
  if (c.kind !== "discovery") continue
  test(`gate enforces current safety policy for discovery case: ${c.id}`, async () => {
    const verdict = await checkInputSafety(c.input)
    const expected = currentExpectations[c.id]
    assert.equal(verdict.action, expected?.action ?? c.safety.action, `action for case ${c.id}`)
    if (expected) assert.equal(verdict.reason, expected.reason, `reason for case ${c.id}`)
    for (const category of c.safety.categories) {
      assert.ok(verdict.categories.includes(category), `category ${category} for case ${c.id}`)
    }
  })
}

test("label check flags a category that contradicts the expected outcome", () => {
  const safeguardingAsSlang: GoldenCase = {
    id: "bad-1",
    input: "synthetic test",
    source: "test",
    kind: "safety",
    category: "valid_slang",
    safety: { action: "safeguarding", crisis: "self_harm", categories: ["suicide_self_harm"] },
  }
  const inventedButReal: GoldenCase = {
    id: "bad-2",
    input: "synthetic test",
    source: "test",
    kind: "discovery",
    category: "invented",
    safety: { action: "safe", categories: [] },
    discovery: { isRealSlang: true },
  }
  const discoveryAsRefusal: GoldenCase = {
    id: "bad-3",
    input: "synthetic test",
    source: "test",
    kind: "discovery",
    category: "refusal",
    safety: { action: "safe", categories: [] },
    discovery: { isRealSlang: false },
  }
  const blockedDiscovery: GoldenCase = {
    id: "bad-4",
    input: "synthetic test",
    source: "test",
    kind: "discovery",
    category: "non_slang",
    safety: { action: "refuse", categories: [] },
    discovery: { isRealSlang: false },
  }
  assert.equal(labelProblems(safeguardingAsSlang).length, 1)
  assert.equal(labelProblems(inventedButReal).length, 1)
  assert.equal(labelProblems(discoveryAsRefusal).length, 1)
  assert.equal(labelProblems(blockedDiscovery).length, 1)
})

test("review entries must refer to existing cases", () => {
  const set: GoldenSet = {
      version: "test",
    review: {
      reviewer: "Me",
      reviewedOn: "12-10-2026",
      version: "test",
      disagreements: [{ id: "no-such-case", note: "synthetic", status: "flagged" }],
    },
    cases: [],
  }
  assert.deepEqual(reviewProblems(set), ['disagreement refers to unknown case id "no-such-case"'])
})

test("a broken golden-set file fails with one clear message per problem", () => {
  const file = path.join(process.cwd(), "tests", "fixtures", "golden-broken.json")
  assert.throws(
    () => loadGoldenSet(file),
    (error: Error) => {
      assert.match(error.message, /\(4 problems\)/)
      assert.match(error.message, /missing-category \(cases\[1\]\): category: Required/)
      assert.match(error.message, /ok-001: duplicate id/)
      assert.match(error.message, /contradictory-label: category "invented" but isRealSlang is true/)
      assert.match(error.message, /unknown-action \(cases\[4\]\): safety\.action: Invalid enum value/)
      return true
    },
  )
})
