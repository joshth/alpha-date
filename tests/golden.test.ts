import "./setup"
import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import {
  DIALECTS,
  EVAL_CATEGORIES,
  type GoldenCase,
  type GoldenSet,
  HELD_OUT_SHARE,
  labelProblems,
  loadGoldenSet,
  reviewProblems,
  SPLITS,
  splitFor,
  WORD_TYPES,
} from "@/lib/eval/golden"
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
    discovery: { isRealSlang: true, wordType: "invented-plausible", split: "held-out", dialect: "US" },
  }
  const discoveryAsRefusal: GoldenCase = {
    id: "bad-3",
    input: "synthetic test",
    source: "test",
    kind: "discovery",
    category: "refusal",
    safety: { action: "safe", categories: [] },
    discovery: { isRealSlang: false, wordType: "real-old", split: "dev", dialect: "US" },
  }
  const blockedDiscovery: GoldenCase = {
    id: "bad-4",
    input: "synthetic test",
    source: "test",
    kind: "discovery",
    category: "non_slang",
    safety: { action: "refuse", categories: [] },
    discovery: { isRealSlang: false, wordType: "real-old", split: "held-out", dialect: "US" },
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
      assert.match(error.message, /\(7 problems\)/)
      assert.match(error.message, /missing-category \(cases\[1\]\): category: Required/)
      assert.match(error.message, /ok-001: duplicate id/)
      assert.match(error.message, /contradictory-label: category "invented" but isRealSlang is true/)
      assert.match(error.message, /unknown-action \(cases\[4\]\): safety\.action: Invalid enum value/)
      assert.match(error.message, /untagged \(cases\[5\]\): discovery\.wordType: Required/)
      assert.match(error.message, /bad-dialect \(cases\[6\]\): discovery\.dialect: Invalid enum value/)
      assert.match(error.message, /wrong-split: split must be "dev" \(from splitFor\(id\)\), not "held-out"/)
      return true
    },
  )
})

test("every discovery case is tagged with word type, split and dialect (W18EDATE-70)", () => {
  for (const c of golden.cases) {
    if (c.kind !== "discovery") continue
    assert.ok(WORD_TYPES.includes(c.discovery.wordType), c.id)
    assert.ok(SPLITS.includes(c.discovery.split), c.id)
    assert.ok(DIALECTS.includes(c.discovery.dialect), c.id)
  }
})

test("the golden set has 160+ cases and every word type, split and dialect is used (W18EDATE-28)", () => {
  assert.ok(golden.cases.length >= 160, `${golden.cases.length} cases`)
  const discovery = golden.cases.filter((c) => c.kind === "discovery")
  for (const wordType of WORD_TYPES) assert.ok(discovery.some((c) => c.discovery.wordType === wordType), wordType)
  for (const split of SPLITS) assert.ok(discovery.some((c) => c.discovery.split === split), split)
  for (const dialect of DIALECTS) assert.ok(discovery.some((c) => c.discovery.dialect === dialect), dialect)
})

test("the held-out split comes from the id hash, is stable and holds out roughly 30%", () => {
  assert.equal(splitFor("discovery-001"), splitFor("discovery-001"))
  const ids = Array.from({ length: 2000 }, (_, i) => `case-${i}`)
  const share = ids.filter((id) => splitFor(id) === "held-out").length / ids.length
  assert.ok(Math.abs(share - HELD_OUT_SHARE) < 0.04, `held-out share ${share}`)
})

test("word type must agree with the category and the real-slang label", () => {
  const base = {
    id: "real-1",
    input: "synthetic test",
    source: "test",
    kind: "discovery" as const,
    safety: { action: "safe" as const, categories: [] },
  }
  const inventedTaggedReal: GoldenCase = {
    ...base,
    category: "invented",
    discovery: { isRealSlang: false, wordType: "real-new", split: "dev", dialect: "US" },
  }
  const slangTaggedInvented: GoldenCase = {
    ...base,
    category: "valid_slang",
    discovery: { isRealSlang: true, wordType: "invented-random", split: "dev", dialect: "UK" },
  }
  assert.deepEqual(labelProblems(inventedTaggedReal), ['real-1: category "invented" but wordType "real-new"'])
  assert.deepEqual(labelProblems(slangTaggedInvented), ['real-1: isRealSlang is true but wordType "invented-random"'])
})
