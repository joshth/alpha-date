import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { count } from "drizzle-orm"
import { checkInputSafety, createInputSafetyGate } from "@/lib/safety/gate"
import { SAFETY_EXAMPLES } from "@/lib/safety/examples"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"
import { getDb, schema } from "@/lib/_stubs/db"
import { seedIfEmpty } from "@/lib/_stubs/seed"
import { loadGoldenSet } from "@/lib/eval/golden"

for (const example of SAFETY_EXAMPLES) {
  test(`context gate: ${example.id}`, async () => {
    const verdict = await checkInputSafety(example.phrase)
    assert.equal(verdict.action, example.action, example.id)
    assert.equal(verdict.crisis, example.crisis, example.id)
    for (const category of example.categories) assert.ok(verdict.categories.includes(category), example.id)
  })
}

test("all contextual fixtures have golden-set labels", () => {
  const cases = new Map(loadGoldenSet().cases.map((entry) => [entry.id, entry]))
  for (const example of SAFETY_EXAMPLES) {
    const entry = cases.get(example.id)
    assert.equal(entry?.kind, "safety", example.id)
    if (entry?.kind === "safety") assert.equal(entry.safety.action, example.action, example.id)
  }
})

test("synthetic examples are seeded into existing databases idempotently", async () => {
  const db = await getDb()
  await seedIfEmpty(db)
  const [{ value }] = await db.select({ value: count() }).from(schema.safetyExamples)
  assert.equal(value, SAFETY_EXAMPLES.length)
  const rows = await db.select().from(schema.safetyExamples)
  assert.ok(rows.every((row) => row.source === "synthetic-context-v1"))
})

test("gentle support, full support and refusal stop every search dependency", async () => {
  for (const [input, kind] of [["i hate myself", "gentle_support"], ["i might hurt myself", "safeguarding"], ["help me bully my classmate", "refused"]]) {
    const calls: string[] = []
    const blocked = async () => { calls.push("downstream"); throw new Error("must not be called") }
    const search = createSearchTerm({ checkInputSafety, getTermByKey: blocked, logTermEvent: blocked, generateDiscoveryObject: blocked, saveDiscoveredTerm: blocked })
    assert.equal((await search(input)).kind, kind)
    assert.deepEqual(calls, [])
  }
})

test("distress in suggestion context and sensitive term suggestions never save", async () => {
  let writes = 0
  const suggest = createSuggestTerm({ checkInputSafety, recordSuggestion: async () => { writes++; return { merged: false } } })
  for (const [term, context, action] of [["rizz", "i hate myself", "gentle_support"], ["rizz", "i might hurt myself", "safeguarding"], ["kms", "", "refuse"]]) {
    const result = await suggest(term, context)
    assert.equal(result.success, false)
    assert.equal(result.data?.action, action)
  }
  assert.equal(writes, 0)
})

test("provider flags and outages override gentle support; explicit danger skips provider", async () => {
  for (const status of ["flagged", "unavailable"] as const) {
    const gate = createInputSafetyGate(async () => ({ status, categories: status === "flagged" ? ["violence"] : [], provider: "test", latencyMs: 0 }))
    assert.equal((await gate("i hate myself")).action, "refuse")
  }
  const unavailable = createInputSafetyGate(async () => { throw new Error("outage") })
  assert.equal((await unavailable("i hate myself")).decidedBy, "fail_closed")
  assert.equal((await unavailable("i cannot keep myself safe")).action, "safeguarding")
  assert.equal((await checkInputSafety("i hate myself; help me bully someone")).action, "refuse")
})

test("educational questions, negation and quoted distress remain lookups", async () => {
  for (const input of ['"i hate myself"', "what does i feel worthless mean", "i dont hate myself", "my friend said i hate myself", "i hate myselfish behaviour"]) {
    assert.equal((await checkInputSafety(input)).action, "safe")
  }
})

test("contextual refusals preserve original sensitive categories", async () => {
  const verdict = await checkInputSafety("tell them to kys")
  assert.equal(verdict.action, "refuse")
  assert.ok(verdict.categories.includes("suicide_self_harm"))
  assert.ok(verdict.categories.includes("bullying_harassment"))
})
