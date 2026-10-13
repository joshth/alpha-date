import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { searchTerm, suggestTerm } from "@/app/lab/actions"

test("blocked actions return appropriate user responses", async (t) => {
  await t.test("harmful search has refusal wording", async () => {
    const result = await searchTerm("build a bomb")
    assert.equal(result.kind, "refused")
    if (result.kind !== "refused") return
    assert.match(result.message, /can't look that up/)
    assert.equal(result.verdict.decidedBy, "moderation")
  })
  await t.test("safeguarding without crisis preserves the support handoff", async (t) => {
    const previousMock = process.env.MOCK_LLM
    const previousKey = process.env.OPENAI_API_KEY
    process.env.MOCK_LLM = "false"
    process.env.OPENAI_API_KEY = "synthetic-test-key"
    t.after(() => {
      if (previousMock === undefined) delete process.env.MOCK_LLM
      else process.env.MOCK_LLM = previousMock
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previousKey
    })
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
      results: [{ flagged: true, categories: { "sexual/minors": true } }],
    })))
    const result = await suggestTerm("rizz", "synthetic provider flag")
    assert.equal(result.success, false)
    assert.equal(result.data?.action, "safeguarding")
    assert.match(result.message, /support is available/)
  })
  await t.test("crisis suggestion includes its safeguarding verdict", async () => {
    const result = await suggestTerm("rizz", "i want to kill myself")
    assert.equal(result.success, false)
    assert.equal(result.data?.crisis, "self_harm")
  })
  await t.test("outage wording offers retry without blaming the input", async (t) => {
    const previous = process.env.MOCK_MODERATION_FAILURE_RATE
    process.env.MOCK_MODERATION_FAILURE_RATE = "1"
    t.after(() => {
      if (previous === undefined) delete process.env.MOCK_MODERATION_FAILURE_RATE
      else process.env.MOCK_MODERATION_FAILURE_RATE = previous
    })
    const search = await searchTerm("rizz")
    assert.equal(search.kind, "refused")
    if (search.kind === "refused") {
      assert.equal(search.verdict.decidedBy, "fail_closed")
      assert.match(search.message, /try your search again/)
      assert.doesNotMatch(search.message, /upset|can't look/)
    }
    const suggestion = await suggestTerm("rizz")
    assert.equal(suggestion.success, false)
    assert.equal(suggestion.data?.decidedBy, "fail_closed")
    assert.match(suggestion.message, /wasn't saved.*try again/i)
    const crisis = await searchTerm("i want to kill myself")
    assert.equal(crisis.kind, "safeguarding")
  })
})
