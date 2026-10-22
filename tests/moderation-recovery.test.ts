import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { moderate } from "@/lib/_stubs/moderation"
import { createInputSafetyGate } from "@/lib/safety/gate"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"

function harness() {
  const calls: string[] = []
  const gate = createInputSafetyGate(moderate)
  return {
    calls,
    search: createSearchTerm({
      checkInputSafety: gate,
      getTermRecord: async () => { calls.push("lookup"); return null },
      logTermEvent: async (_query, event) => { calls.push(event) },
      generateDiscoveryObject: async () => {
        calls.push("discovery")
        return { isLegit: true, definition: "Synthetic definition." }
      },
      saveDiscoveredTerm: async () => { calls.push("save"); return null },
    }),
    suggest: createSuggestTerm({
      checkInputSafety: gate,
      recordSuggestion: async () => { calls.push("suggestion"); return { merged: false } },
    }),
  }
}

const safeResponse = () => Response.json({
  results: [{ flagged: false, categories: { violence: false } }],
})

test("moderation failures and recovery stay isolated across request flows", async (t) => {
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

  const failures: { name: string; respond: (init?: RequestInit) => Promise<Response> }[] = [
    {
      name: "timeout",
      respond: async (init) => {
        assert.ok(init?.signal)
        const signal = init.signal
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true })
          queueMicrotask(() => deadline.abort(new DOMException("Synthetic timeout", "TimeoutError")))
        })
      },
    },
    { name: "network failure", respond: async () => { throw new TypeError("Synthetic offline failure") } },
    { name: "HTTP 429", respond: async () => new Response("rate limited", { status: 429 }) },
    { name: "HTTP 503", respond: async () => new Response("unavailable", { status: 503 }) },
    { name: "invalid JSON", respond: async () => new Response("not json") },
    { name: "empty results", respond: async () => Response.json({ results: [] }) },
    {
      name: "invalid category type",
      respond: async () => Response.json({ results: [{ flagged: false, categories: { violence: "false" } }] }),
    },
    {
      name: "multiple results",
      respond: async () => Response.json({
        results: [
          { flagged: false, categories: { violence: false } },
          { flagged: true, categories: { violence: true } },
        ],
      }),
    },
  ]
  let deadline: AbortController

  for (const failure of failures) {
    for (const surface of ["search", "suggestion"] as const) {
      await t.test(`${failure.name}: ${surface} blocks writes and the next request recovers`, async (t) => {
        const h = harness()
        let requests = 0
        if (failure.name === "timeout") {
          t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
            assert.equal(milliseconds, 2000)
            deadline = new AbortController()
            return deadline.signal
          })
        }
        t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
          requests++
          return requests === 1 ? failure.respond(init) : safeResponse()
        })

        if (surface === "search") {
          const blocked = await h.search("rizz")
          assert.equal(blocked.kind, "refused")
          if (blocked.kind !== "refused") assert.fail("Expected a refused search")
          assert.equal(blocked.verdict.decidedBy, "fail_closed")
          assert.equal(blocked.verdict.reason, "moderation_unavailable")
          assert.match(blocked.message, /try your search again/i)
          assert.deepEqual(h.calls, [])
          assert.equal(requests, 1)
          if (failure.name === "timeout") assert.equal(deadline.signal.aborted, true)

          assert.equal((await h.search("rizz")).kind, "discovered")
          assert.deepEqual(h.calls, ["lookup", "search_miss", "discovery", "save", "llm_generated"])
        } else {
          const blocked = await h.suggest("rizz", "ordinary context")
          assert.equal(blocked.success, false)
          assert.equal(blocked.data?.decidedBy, "fail_closed")
          assert.equal(blocked.data?.reason, "moderation_unavailable")
          assert.match(blocked.message, /wasn't saved.*try again/i)
          assert.deepEqual(h.calls, [])
          assert.equal(requests, 1)
          if (failure.name === "timeout") assert.equal(deadline.signal.aborted, true)

          assert.equal((await h.suggest("rizz", "ordinary context")).success, true)
          assert.deepEqual(h.calls, ["suggestion"])
        }
        assert.equal(requests, 2)
      })
    }
  }

  for (const surface of ["search", "suggestion"] as const) {
    await t.test(`deterministic crisis skips an unavailable provider on ${surface}`, async (t) => {
      const h = harness()
      let requests = 0
      t.mock.method(globalThis, "fetch", async () => {
        requests++
        throw new TypeError("Synthetic offline failure")
      })
      if (surface === "search") {
        const result = await h.search("i want to kill myself")
        assert.equal(result.kind, "safeguarding")
        if (result.kind === "safeguarding") assert.equal(result.verdict.decidedBy, "rules")
      } else {
        const result = await h.suggest("rizz", "i want to kill myself")
        assert.equal(result.success, false)
        assert.equal(result.data?.action, "safeguarding")
        assert.equal(result.data?.decidedBy, "rules")
      }
      assert.equal(requests, 0)
      assert.deepEqual(h.calls, [])
    })
  }

  await t.test("a healthy request does not bypass a later outage or poison its recovery", async (t) => {
    const h = harness()
    let requests = 0
    t.mock.method(globalThis, "fetch", async () => {
      requests++
      return requests === 2 ? new Response("unavailable", { status: 503 }) : safeResponse()
    })
    assert.equal((await h.suggest("rizz", "ordinary context")).success, true)
    assert.deepEqual(h.calls, ["suggestion"])
    const blocked = await h.search("rizz")
    assert.equal(blocked.kind, "refused")
    assert.deepEqual(h.calls, ["suggestion"])
    assert.equal((await h.search("rizz")).kind, "discovered")
    assert.equal(requests, 3)
    assert.deepEqual(h.calls, ["suggestion", "lookup", "search_miss", "discovery", "save", "llm_generated"])
  })
})
