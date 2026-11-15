import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { termFeedback } from "@/lib/_stubs/schema"
import { getDedupSavings } from "@/app/lab/actions"

process.env.SKIP_SEED = "true"

const fixture = [["brainrot", 5], ["brain rot", 2], ["brain-rot", 1], ["brainrottt", 1], ["rizz", 3]] as const

test("getDedupSavings reads the real table and applies the minutes assumption", async () => {
  const db = await getDb()
  await db.delete(termFeedback)
  await db.insert(termFeedback).values(fixture.map(([suggestedTerm, count]) => ({ suggestedTerm, count, status: "pending" })))

  const s = await getDedupSavings()
  assert.equal(s.rawRows, 5)
  assert.equal(s.distinctKeys, 3)
  assert.equal(s.estimate.assumption, "2 min per review")
  assert.equal((await getDedupSavings(3)).estimate.assumption, "3 min per review")
})

test("invalid minutes fall back to 2", async () => {
  for (const bad of [NaN, -1, 100000, "x" as any]) {
    assert.equal((await getDedupSavings(bad)).estimate.assumption, "2 min per review", String(bad))
  }
})
