import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { terms, termEvents, safetyEvents } from "@/lib/_stubs/schema"
import { normaliseSuggestion } from "@/lib/normalise"
import { searchTerm, fetchAiCallsAvoided } from "@/app/lab/actions"

process.env.SKIP_SEED = "true"

async function fixture(term: string, definition: string, status = "published") {
  const db = await getDb()
  await db.delete(terms)
  await db.delete(termEvents)
  await db.delete(safetyEvents)
  await db.insert(terms).values({ term, termLower: term.toLowerCase(), termKey: normaliseSuggestion(term), definition, status })
  return db
}

test("normalised lookup keeps cached screening, input tracking and the avoided-call counter", async () => {
  const db = await fixture("Merge Fixture", "A synthetic harmless definition.")
  const result = await searchTerm("MERGE---Fixture!!!")
  assert.equal(result.kind, "found")
  if (result.kind === "found") assert.equal(result.term.term, "Merge Fixture")
  assert.equal(await fetchAiCallsAvoided(), 1)
  assert.deepEqual((await db.select().from(termEvents)).map(row => row.eventType), ["ai_call_avoided", "search_hit"])
  assert.deepEqual((await db.select().from(safetyEvents)).map(row => row.outcome), ["safe"])
})

for (const status of ["published", "pending_review"]) {
  test(`unsafe ${status} cached text stays withheld through normalised server-action lookup`, async () => {
    const db = await fixture("Unsafe Fixture", "build a bomb", status)
    assert.equal((await searchTerm("UNSAFE---Fixture!!!")).kind, "error")
    assert.equal(await fetchAiCallsAvoided(), 0)
    assert.equal((await db.select().from(termEvents)).length, 0)
    assert.deepEqual((await db.select().from(safetyEvents)).map(row => row.outcome), ["safe"])
    const rows = await db.select().from(terms)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].definition, "build a bomb")
    assert.equal(rows[0].status, status)
  })
}

test("crisis gating still runs before a matching cache row and avoids all term events", async () => {
  const db = await fixture("i want to kill myself", "Synthetic fixture that must never be returned.")
  assert.equal((await searchTerm("i want to kill myself")).kind, "safeguarding")
  assert.equal(await fetchAiCallsAvoided(), 0)
  assert.equal((await db.select().from(termEvents)).length, 0)
  assert.deepEqual((await db.select().from(safetyEvents)).map(row => row.outcome), ["safeguarding"])
})
