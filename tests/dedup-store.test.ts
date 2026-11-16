import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { termFeedback } from "@/lib/_stubs/schema"
import { readDedupSavings } from "@/lib/dedup/store"

process.env.SKIP_SEED = "true"

const fixture = [["brainrot", 5], ["brain rot", 2], ["brain-rot", 1], ["brainrottt", 1], ["rizz", 3]] as const

test("savings are read from the real table and update when suggestions are added", async () => {
  const db = await getDb()
  await db.delete(termFeedback)
  await db.insert(termFeedback).values(fixture.map(([suggestedTerm, count]) => ({ suggestedTerm, count, status: "pending" })))

  const before = await readDedupSavings()
  assert.equal(before.rawRows, 5)
  assert.equal(before.distinctKeys, 3)
  assert.equal(before.merged, 2)
  assert.equal(before.reductionPct, 40)
  assert.ok(before.storageSavedBytes > 0, "pg_column_size is really measured")

  await db.insert(termFeedback).values({ suggestedTerm: "brain.rot", count: 1, status: "pending" })
  const after = await readDedupSavings()
  assert.equal(after.rawRows, 6)
  assert.equal(after.merged, 3)
})
