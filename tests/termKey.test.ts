import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/_stubs/db"
import { terms } from "@/lib/_stubs/schema"
import { normaliseSuggestion } from "@/lib/normalise"
import { slangDatabase } from "@/lib/lexicon-data"
import { SYNTHETIC_PENDING_TERMS } from "@/lib/_stubs/fixtures/synthetic"
import { toDiscoveredTerm } from "@/lib/discovery/discover"
import { saveDiscoveredTerm } from "@/lib/terms-store"

test("every seeded term has a termKey matching normaliseSuggestion(term)", async () => {
  const db = await getDb()
  const seededTerms = new Set([
    ...slangDatabase.map((t) => t.term),
    ...SYNTHETIC_PENDING_TERMS.map((t) => t.term),
  ])
  const rows = await db.select().from(terms)
  const seededRows = rows.filter((row) => seededTerms.has(row.term))

  assert.ok(seededRows.length >= seededTerms.size, "expected both seed inserts to be represented")
  for (const row of seededRows) {
    assert.equal(row.termKey, normaliseSuggestion(row.term))
  }
})


test("no seeded row has an empty termKey", async () => {
  const db = await getDb()
  const rows = await db.select().from(terms)
  for (const row of rows) {
    assert.equal(typeof row.termKey, "string")
    assert.ok(row.termKey.length > 0, `empty termKey for term "${row.term}"`)
  }
})

test("Rizz has the key rizz", async () => {
  const db = await getDb()
  const [row] = await db.select().from(terms).where(eq(terms.term, "Rizz"))
  assert.ok(row, "expected a seeded row for Rizz")
  assert.equal(row.termKey, "rizz")
})

test("a shared termKey across different terms is allowed (plain, not unique, index)", async () => {
  const db = await getDb()
  await db.insert(terms).values([
    {
      term: "Yappulus",
      termLower: "yappulus",
      termKey: "yappulus",
      definition: "test row",
      source: "seed",
      status: "published",
    },
    {
      term: "yappulus!",
      termLower: "yappulus!",
      termKey: "yappulus",
      definition: "test row",
      source: "seed",
      status: "published",
    },
  ])

  const allRows = await db.select().from(terms)
  const rows = allRows.filter((row) => row.term === "Yappulus" || row.term === "yappulus!")
  assert.equal(rows.length, 2)
  for (const row of rows) {
    assert.equal(row.termKey, "yappulus")
  }
})

test("saveDiscoveredTerm sets termKey via normaliseSuggestion", async () => {
  const discovered = toDiscoveredTerm("Glonking", { isLegit: true, definition: "Doing something clumsily." })!
  const saved = await saveDiscoveredTerm(discovered)
  assert.ok(saved, "expected saveDiscoveredTerm to insert a row")

  const db = await getDb()
  const [row] = await db.select().from(terms).where(eq(terms.id, saved!.id))
  assert.equal(row.termKey, normaliseSuggestion(discovered.term))
})