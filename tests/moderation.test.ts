import { test } from "node:test"
import assert from "node:assert/strict"
import { moderate } from "@/lib/_stubs/moderation"

test("real moderation validates provider responses", async (t) => {
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

  const cases = [
    { name: "safe response", body: { results: [{ flagged: false, categories: { violence: false } }] }, status: "safe", categories: [] },
    { name: "flagged response", body: { results: [{ flagged: true, categories: { violence: true, hate: false } }] }, status: "flagged", categories: ["violence"] },
    { name: "unknown category", body: { results: [{ flagged: true, categories: { "future-category": true } }] }, status: "flagged", categories: ["future-category"] },
    { name: "contradictory safe flag", body: { results: [{ flagged: false, categories: { violence: true } }] }, status: "flagged", categories: ["violence"] },
    { name: "flagged without active categories", body: { results: [{ flagged: true, categories: { violence: false } }] }, status: "flagged", categories: [] },
    ...[
      null, {}, { results: [] }, { results: [null] },
      { results: [{ categories: { violence: false } }] },
      { results: [{ flagged: "false", categories: { violence: false } }] },
      { results: [{ flagged: false, categories: {} }] },
      { results: [{ flagged: false, categories: [] }] },
      { results: [{ flagged: false, categories: { violence: "false" } }] },
      { results: [{ flagged: false, categories: { violence: null } }] },
      { results: [{ flagged: false, categories: { violence: false } }, { flagged: true, categories: { violence: true } }] },
    ].map((body, index) => ({ name: `malformed response ${index + 1}`, body, status: "unavailable", categories: [] })),
  ]

  for (const entry of cases) {
    await t.test(entry.name, async (t) => {
      t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(entry.body)))
      const result = await moderate("synthetic input")
      assert.equal(result.status, entry.status)
      assert.deepEqual(result.categories, entry.categories)
      assert.equal(result.provider, "openai")
      assert.ok(result.latencyMs >= 0)
    })
  }

  for (const [name, respond] of [
    ["invalid JSON", async () => new Response("not json")],
    ["HTTP failure", async () => new Response("unavailable", { status: 503 })],
    ["network failure", async () => { throw new TypeError("offline") }],
  ] as const) {
    await t.test(name, async (t) => {
      t.mock.method(globalThis, "fetch", respond)
      const result = await moderate("synthetic input")
      assert.equal(result.status, "unavailable")
      assert.deepEqual(result.categories, [])
      assert.equal(result.provider, "openai")
    })
  }
})
