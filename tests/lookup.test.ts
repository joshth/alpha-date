import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { terms } from "@/lib/_stubs/schema"
import type { DiscoveryOutput } from "@/lib/discovery/prompt"
import { runSearch } from "@/lib/search"
import { countTermEvents } from "@/lib/terms-store"

// Stands in for the real generate function passed to runSearch. Counting
// calls lets a test assert whether the (expensive) model lookup was reached
// at all, not just what runSearch returned.
function makeSpy() {
  const spy = {
    count: 0,
    generate: async (_input: { prompt: string; searchTerm: string }): Promise<DiscoveryOutput> => {
      spy.count++
      return { isLegit: false }
    },
  }
  return spy
}

test("Rizz is found by key lookup without calling the model", async () => {
  const spy = makeSpy()
  const result = await runSearch("Rizz", spy.generate)
  assert.equal(result.kind, "found")
  assert.equal(spy.count, 0)
})

// "Rizzzz" collapses to the same normalised key as "Rizz" (repeated-letter
// rule), so the key lookup should still hit without ever calling the model.
test("Rizzzz collapses to the same key as Rizz and is found without calling the model", async () => {
  const spy = makeSpy()
  const result = await runSearch("Rizzzz", spy.generate)
  assert.equal(result.kind, "found")
  assert.equal(spy.count, 0)
})

// Unknown term: the key lookup misses, so runSearch must fall through to
// discovery and call generate exactly once.
test("zorpblat is not found and the model is called exactly once", async () => {
  const spy = makeSpy()
  const result = await runSearch("zorpblat", spy.generate)
  assert.equal(result.kind, "not_found")
  assert.equal(spy.count, 1)
})

// "Gyatt" is seeded, but "gyat" normalises to a different key, so this must
// miss the lookup and reach the model — proving the match is key-based, not
// a loose/fuzzy one.
test("gyat does not match the seeded Gyatt and calls the model once", async () => {
  const spy = makeSpy()
  const result = await runSearch("gyat", spy.generate)
  assert.equal(result.kind, "not_found")
  assert.equal(spy.count, 1)
})

// A rejected row still counts as "known" for lookup purposes — it must not
// trigger a fresh model call, even though the result is not_found.
test("a rejected term is not found and the model is not called", async () => {
  const db = await getDb()
  await db.insert(terms).values({
    term: "Snarf",
    termLower: "snarf",
    termKey: "snarf",
    definition: "test row",
    source: "seed",
    status: "rejected",
  })

  const spy = makeSpy()
  const result = await runSearch("snarf", spy.generate)
  assert.equal(result.kind, "not_found")
  assert.equal(spy.count, 0)
})

// Insert the rejected row FIRST and the published one SECOND, so a pass
// can't be explained by "the lookup just returns whichever row was inserted
// last" — it has to be status-ranked (published > pending_review > rejected).
test("when a key has multiple rows, the published one wins regardless of insertion order", async () => {
  const db = await getDb()
  await db.insert(terms).values({
    term: "blorp!",
    termLower: "blorp!",
    termKey: "blorp",
    definition: "rejected definition",
    source: "seed",
    status: "rejected",
  })
  await db.insert(terms).values({
    term: "Blorp",
    termLower: "blorp",
    termKey: "blorp",
    definition: "published definition",
    source: "seed",
    status: "published",
  })

  const spy = makeSpy()
  const result = await runSearch("blorp", spy.generate)
  assert.equal(result.kind, "found")
  assert.equal(spy.count, 0)
  if (result.kind === "found") {
    assert.equal(result.term.definition, "published definition")
  }
})

// The seed already holds thousands of search_hit events, so the test reads
// the counter before and after and checks the DIFFERENCE (not an absolute
// value) — "Rizz" is known (+1 avoided call), "zorpblat2" is not (+0).
test("ai_call_avoided rises by exactly 1 when a known term is searched twice (once known, once not)", async () => {
  const before = await countTermEvents("ai_call_avoided")

  const spy = makeSpy()
  await runSearch("Rizz", spy.generate)
  await runSearch("zorpblat2", spy.generate)

  const after = await countTermEvents("ai_call_avoided")
  assert.equal(after - before, 1)
})
