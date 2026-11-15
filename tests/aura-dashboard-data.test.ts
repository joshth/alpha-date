import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import * as store from "@/lib/terms-store"
import { getDb } from "@/lib/_stubs/db"
import { termEvents } from "@/lib/_stubs/schema"

process.env.SKIP_SEED = "true"

test("Aura dashboard terms are distinct and exclude generated-only events", async () => {
  const db = await getDb()
  await db.delete(termEvents)
  await db.insert(termEvents).values([
    { termLower: "rizz", eventType: "search_hit" },
    { termLower: "rizz", eventType: "search_miss" },
    { termLower: "six seven", eventType: "search_miss" },
    { termLower: "generated only", eventType: "llm_generated" },
    { termLower: "prompt only", eventType: "prompt_generated" },
  ])

  const list = (store as any).listTermsWithSearchData
  assert.equal(typeof list, "function", "terms-store should expose the Aura dashboard term list")
  assert.deepEqual(await list(), ["rizz", "six seven"])
})
