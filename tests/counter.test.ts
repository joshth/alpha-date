import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import type { DiscoveryOutput } from "@/lib/discovery/prompt"
import { createSearchTerm } from "@/lib/search"
import { checkInputSafety } from "@/lib/safety/gate"
import { getAiCallsAvoided, getTermByKey, logTermEvent, saveDiscoveredTerm } from "@/lib/terms-store"

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

function runSearch(query: string, generate: ReturnType<typeof makeSpy>["generate"]) {
  return createSearchTerm({ checkInputSafety, getTermByKey, logTermEvent, generateDiscoveryObject: generate, saveDiscoveredTerm })(query)
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
