import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { terms, termFeedback } from "@/lib/_stubs/schema"
import { getDedupGraph } from "@/app/lab/actions"

process.env.SKIP_SEED = "true"

test("getDedupGraph returns counted rows, published lexicon and golden dedup cases", async () => {
  const db = await getDb()
  await db.delete(termFeedback)
  await db.delete(terms)
  await db.insert(termFeedback).values([["brainrot", 5], ["brain rot", 2], ["rizz", 3], ["rizzler", 1], ["mid", 4]].map(([suggestedTerm, count]) => ({ suggestedTerm: suggestedTerm as string, count: count as number, status: "pending", context: "secret ctx", userIp: "1.2.3.4" })))
  await db.insert(terms).values(["mid", "skibidi"].map((term) => ({ term, termLower: term, termKey: term, definition: "A synthetic harmless definition.", status: "published" })))

  const g = await getDedupGraph()
  assert.deepEqual(g.rows.map((r) => r.suggestedTerm), ["brainrot", "mid", "rizz", "brain rot", "rizzler"])
  assert.deepEqual(g.rows.map((r) => r.count), [5, 4, 3, 2, 1])
  assert.deepEqual(Object.keys(g.rows[0]), ["suggestedTerm", "count"])
  assert.ok(g.lexicon.includes("mid") && g.lexicon.includes("skibidi"))
  assert.equal(g.golden.length, 8)
  const c = g.golden[0]
  assert.equal(typeof c.input, "string")
  assert.equal(typeof c.candidate, "string")
  assert.equal(typeof c.sameTerm, "boolean")
})
