import "./setup"
import assert from "node:assert/strict"
import test from "node:test"
import { sql } from "drizzle-orm"
import { getDb, schema } from "@/lib/_stubs/db"
import { listSuggestions, recordSuggestion } from "@/lib/feedback"
import { formatReviewTime } from "@/lib/review-time"
import { listTermsByStatus } from "@/lib/terms-store"

process.env.SKIP_SEED = "true"

test("review timestamps show Sydney date, time and daylight-saving offset", () => {
  assert.match(formatReviewTime("2026-11-12T05:41:09Z"), /12\/11\/2026.*4:41:09 pm AEDT/)
  assert.match(formatReviewTime("2026-06-12T05:41:09Z"), /12\/06\/2026.*3:41:09 pm AEST/)
  assert.match(formatReviewTime("2026-11-12T13:30:00Z"), /13\/11\/2026.*12:30:00 am AEDT/)
})

test("review readers preserve the actual instant in UTC and Sydney database sessions", async () => {
  const db = await getDb()
  const expected = "2026-11-12T05:41:09.000Z"
  try {
    for (const zone of ["UTC", "Australia/Sydney"]) {
      await db.execute(sql`select set_config('TimeZone', ${zone}, false)`)
      await db.delete(schema.terms)
      await db.delete(schema.termFeedback)
      const createdAt = sql`${expected}::timestamptz AT TIME ZONE current_setting('TimeZone')`
      await db.insert(schema.terms).values({ term: "Time fixture", termLower: "time fixture", termKey: "timefixture", definition: "Synthetic definition.", status: "pending_review", createdAt })
      await db.insert(schema.termFeedback).values({ suggestedTerm: "time fixture", createdAt })
      const [term] = await listTermsByStatus("pending_review")
      const [suggestion] = await listSuggestions()
      assert.equal(term.createdAt, expected, zone)
      assert.equal(suggestion.createdAt, expected, zone)
      await recordSuggestion("time fixture", null)
      const [merged] = await listSuggestions()
      assert.equal(merged.createdAt, expected)
      assert.equal(merged.count, 2)
    }
  } finally {
    await db.execute(sql`select set_config('TimeZone', 'UTC', false)`)
  }
})
