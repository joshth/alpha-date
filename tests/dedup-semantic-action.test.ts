import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { terms, termFeedback } from "@/lib/_stubs/schema"
import { getDedupSavings, getSemanticEdges } from "@/app/lab/actions"

process.env.SKIP_SEED = "true"
process.env.MOCK_LLM = "true"

test("getSemanticEdges gives hint edges only, offline, and never merges", async () => {
  const db = await getDb()
  await db.delete(termFeedback)
  await db.delete(terms)
  await db.insert(termFeedback).values([["rizzler", 5], ["huzz", 3], ["tuff", 2], ["chopped", 2], ["brain rot", 4], ["brainrot", 1]].map(([suggestedTerm, count]) => ({ suggestedTerm: suggestedTerm as string, count: count as number, status: "pending", context: "ctx", userIp: "1.2.3.4" })))

  const before = await getDedupSavings()
  const realFetch = globalThis.fetch
  globalThis.fetch = (() => { throw new Error("network used in mock mode") }) as typeof fetch
  let edges
  try { edges = await getSemanticEdges() } finally { globalThis.fetch = realFetch }

  const rh = edges.find((e) => e.id === "huzz|rizzler")
  assert.ok(rh, "rizzler|huzz edge")
  assert.equal(rh.reason, "semantic")
  assert.equal(rh.source, "rizzler")
  assert.ok(!edges.some((e) => e.source === "chopped" || e.target === "chopped"))
  assert.ok(!edges.some((e) => e.id.includes("brain")))
  assert.deepEqual(await getDedupSavings(), before)
})
