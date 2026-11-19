import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import type { SlangTerm } from "@/app/types"
import { count, eq } from "drizzle-orm"
import { getDb } from "@/lib/_stubs/db"
import { terms } from "@/lib/_stubs/schema"
import { saveDiscoveredTerm } from "@/lib/terms-store"

const term: SlangTerm = {
  id: "race-1",
  term: "Zorpwhistle",
  definition: "A made-up word used only by this test.",
  examples: ["That was so zorpwhistle."],
  originAndContext: "Test fixture.",
  commonSentiment: "Neutral",
  sensitivityRating: "Generally Harmless",
}

// Two searches for the same new term can finish at the same time. The unique
// term key in the database must keep one row; the loser gets null, not an error.
test("two simultaneous saves of one new term store exactly one row", async () => {
  const results = await Promise.all([saveDiscoveredTerm(term), saveDiscoveredTerm({ ...term, id: "race-2" })])
  assert.equal(results.filter((record) => record !== null).length, 1)
  const [row] = await (await getDb()).select({ n: count() }).from(terms).where(eq(terms.termLower, "zorpwhistle"))
  assert.equal(row.n, 1)
})
