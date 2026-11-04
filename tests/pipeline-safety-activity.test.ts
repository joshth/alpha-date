import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { safetyEvents, termEvents, terms } from "@/lib/_stubs/schema"
import { traceSearch } from "@/app/lab/pipeline/actions"

process.env.SKIP_SEED = "true"
async function reset(definition = "A synthetic harmless definition.") {
  const db = await getDb()
  await db.delete(safetyEvents)
  await db.delete(termEvents)
  await db.delete(terms)
  await db.insert(terms).values({ term: "analytics-fixture", termLower: "analytics-fixture", termKey: "analyticsfixture", definition, status: "published" })
  return db
}
for (const [input, kind, outcome] of [
  ["analytics-fixture", "found", "safe"],
  ["build a bomb", "refused", "refuse"],
  ["i want to kill myself", "safeguarding", "safeguarding"],
  ["i hate myself", "gentle_support", "gentle_support"],
] as const) {
  test(`pipeline ${outcome} records exactly one anonymous input outcome`, async () => {
    const db = await reset()
    assert.equal((await traceSearch(input)).outcome.kind, kind)
    const rows = await db.select().from(safetyEvents)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].outcome, outcome)
    assert.equal(JSON.stringify(rows).includes(input), false)
    if (outcome !== "safe") assert.equal((await db.select().from(termEvents)).length, 0)
  })
}
test("pipeline cache safety withholds unsafe output while recording the input decision", async () => {
  const db = await reset("build a bomb")
  assert.equal((await traceSearch("analytics-fixture")).outcome.kind, "error")
  assert.deepEqual((await db.select().from(safetyEvents)).map(row => row.outcome), ["safe"])
  assert.equal((await db.select().from(termEvents)).length, 0)
  assert.equal((await db.select().from(terms)).length, 1)
})
test("blank pipeline input records no evaluated outcome", async () => {
  const db = await reset()
  assert.equal((await traceSearch("")).outcome.kind, "error")
  assert.equal((await db.select().from(safetyEvents)).length, 0)
})
