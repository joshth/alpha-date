import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import type { DiscoveryOutput } from "@/lib/discovery/prompt"
import { runSearch } from "@/lib/search"
import { getAiCallsAvoided } from "@/lib/terms-store"

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

// Demo start: the seed holds thousands of search/discovery events but none
// of type ai_call_avoided, so the counter must read 0 before any search runs.
test("getAiCallsAvoided is 0 on a fresh database", async () => {
  assert.equal(await getAiCallsAvoided(), 0)
})

test("searching a known term raises the counter by 1", async () => {
  const spy = makeSpy()
  await runSearch("Rizz", spy.generate)
  assert.equal(await getAiCallsAvoided(), 1)
})

// A discovery (unknown term, model consulted) is not an avoided call — the
// counter must stay flat.
test("searching an unknown term does not raise the counter", async () => {
  const spy = makeSpy()
  await runSearch("zorpblat", spy.generate)
  assert.equal(await getAiCallsAvoided(), 1)
})

test("searching the known term again raises the counter again", async () => {
  const spy = makeSpy()
  await runSearch("rizz", spy.generate)
  assert.equal(await getAiCallsAvoided(), 2)
})
