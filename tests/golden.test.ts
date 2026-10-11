import assert from "node:assert/strict"
import { test } from "node:test"
import { EVAL_CATEGORIES, type GoldenCase, labelProblems, loadGoldenSet } from "@/lib/eval/golden"

test("every safety and discovery case has a consistent evaluation category", () => {
  const set = loadGoldenSet()
  for (const c of set.cases) {
    if (c.kind === "dedup") continue
    assert.ok(EVAL_CATEGORIES.includes(c.category), c.id)
    assert.deepEqual(labelProblems(c), [], c.id)
  }
})

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
    discovery: { isRealSlang: true },
  }
  const discoveryAsRefusal: GoldenCase = {
    id: "bad-3",
    input: "synthetic test",
    source: "test",
    kind: "discovery",
    category: "refusal",
    discovery: { isRealSlang: false },
  }
  assert.equal(labelProblems(safeguardingAsSlang).length, 1)
  assert.equal(labelProblems(inventedButReal).length, 1)
  assert.equal(labelProblems(discoveryAsRefusal).length, 1)
})
