import "./setup"
import assert from "node:assert/strict"
import { test } from "node:test"
import { EVAL_CATEGORIES, type GoldenCase, type GoldenSet, labelProblems, loadGoldenSet, reviewProblems } from "@/lib/eval/golden"
import { checkInputSafety } from "@/lib/safety/gate"

const golden = loadGoldenSet()

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
  test(`gate lets discovery case through: ${c.id}`, async () => {
    const verdict = await checkInputSafety(c.input)
    assert.equal(verdict.action, c.safety.action, `action for case ${c.id}`)
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
