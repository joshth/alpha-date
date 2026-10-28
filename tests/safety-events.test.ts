import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { createTrackedSafetyGate, safetyEventSchema, type SafetyEvent } from "@/lib/safety/events"
import { createInputSafetyGate, type SafetyVerdict, type SafetySurface } from "@/lib/safety/gate"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"

const recordedAt = "2026-10-28T01:00:00.000Z"
const now = () => new Date(recordedAt)
const verdict = (action: SafetyVerdict["action"]): SafetyVerdict => ({
  action, categories: [], crisis: null, decidedBy: "moderation", reason: "clear",
})

for (const action of ["safe", "refuse", "safeguarding"] as const) {
  test(`records only approved fields for ${action}`, async () => {
    const events: SafetyEvent[] = []
    const result = { ...verdict(action), reason: "private fixture text", userId: "private-id" }
    const gate = createTrackedSafetyGate(async () => result, async event => { events.push(event) }, now)
    assert.equal(await gate("private fixture text", "suggestion"), result)
    assert.deepEqual(events, [{ outcome: action, categories: [], recordedAt }])
    assert.equal(JSON.stringify(events).includes("private"), false)
  })

  test(`a failed recorder preserves ${action} and the next request recovers`, async () => {
    let attempts = 0
    const events: SafetyEvent[] = []
    const result = verdict(action)
    const gate = createTrackedSafetyGate(async () => result, async event => {
      if (++attempts === 1) throw new Error("private database details")
      events.push(event)
    }, now)
    assert.equal(await gate("first"), result)
    assert.equal(await gate("second"), result)
    assert.equal(attempts, 2)
    assert.deepEqual(events, [{ outcome: action, categories: [], recordedAt }])
  })
}

test("passes the exact input and surface to the gate, defaulting to search", async () => {
  const calls: unknown[] = []
  const gate = createTrackedSafetyGate(async (...args) => { calls.push(args); return verdict("safe") }, async () => {}, now)
  await gate("unchanged\ntext")
  await gate("context", "suggestion")
  assert.deepEqual(calls, [["unchanged\ntext", "search"], ["context", "suggestion"]])
})

test("copies and deduplicates categories without exposing the verdict to recorder mutation", async () => {
  const result: SafetyVerdict = { ...verdict("safeguarding"), categories: ["suicide_self_harm", "suicide_self_harm"] }
  const gate = createTrackedSafetyGate(async () => result, async event => {
    assert.deepEqual(event.categories, ["suicide_self_harm"])
    event.categories.push("violence_threat")
    event.outcome = "safe"
  }, now)
  assert.equal(await gate("synthetic input"), result)
  assert.equal(result.action, "safeguarding")
  assert.deepEqual(result.categories, ["suicide_self_harm", "suicide_self_harm"])
})

test("each verdict receives its own timestamp", async () => {
  let tick = 0
  const times: string[] = []
  const gate = createTrackedSafetyGate(async () => verdict("safe"), async event => { times.push(event.recordedAt) },
    () => new Date(Date.parse(recordedAt) + tick++ * 1000))
  await gate("one")
  await gate("two")
  assert.deepEqual(times, [recordedAt, "2026-10-28T01:00:01.000Z"])
})

test("clock failure preserves the verdict and skips the recorder", async () => {
  let writes = 0
  const result = verdict("refuse")
  const gate = createTrackedSafetyGate(async () => result, async () => { writes++ }, () => new Date(NaN))
  assert.equal(await gate("input"), result)
  assert.equal(writes, 0)
})

test("a gate failure propagates without inventing an evaluated outcome", async () => {
  let writes = 0
  const failure = new Error("gate unavailable")
  const gate = createTrackedSafetyGate(async () => { throw failure }, async () => { writes++ }, now)
  await assert.rejects(gate("input"), error => error === failure)
  assert.equal(writes, 0)
})

test("unrecognised category text is never sent to the recorder", async () => {
  let writes = 0
  const result = { ...verdict("refuse"), categories: ["private input"] } as unknown as SafetyVerdict
  const gate = createTrackedSafetyGate(async () => result, async () => { writes++ }, now)
  assert.equal(await gate("input"), result)
  assert.equal(writes, 0)
})

test("event contract rejects extra fields and arbitrary labels", () => {
  const event = { outcome: "safe", categories: [], recordedAt }
  for (const field of ["text", "term", "context", "reason", "userId", "ip", "sessionId", "surface"]) {
    assert.equal(safetyEventSchema.safeParse({ ...event, [field]: "private" }).success, false)
  }
  assert.equal(safetyEventSchema.safeParse({ ...event, outcome: "private" }).success, false)
  assert.equal(safetyEventSchema.safeParse({ ...event, categories: ["private"] }).success, false)
  assert.equal(safetyEventSchema.safeParse({ ...event, recordedAt: "yesterday" }).success, false)
  assert.equal(safetyEventSchema.safeParse({ ...event, outcome: "gentle_support" }).success, true)
})

for (const surface of ["search", "suggestion"] as const satisfies SafetySurface[]) {
  for (const scenario of ["clear", "crisis", "outage"] as const) {
    test(`${surface}: ${scenario} records before downstream work and retains safety boundaries`, async () => {
      const calls: string[] = []
      const events: SafetyEvent[] = []
      const gate = createTrackedSafetyGate(createInputSafetyGate(async () => {
        calls.push("moderation")
        return { status: scenario === "outage" ? "unavailable" : "safe", categories: [], provider: "test", latencyMs: 0 }
      }), async event => { calls.push("event"); events.push(event) }, now)
      const input = scenario === "crisis" ? "i want to kill myself" : "rizz"
      if (surface === "search") {
        const search = createSearchTerm({
          checkInputSafety: gate,
          getTermRecord: async () => { calls.push("lookup"); return null },
          logTermEvent: async () => { calls.push("usage") },
          generateDiscoveryObject: async () => { calls.push("discovery"); return { isLegit: false } },
          saveDiscoveredTerm: async () => { assert.fail("No term should be saved") },
        })
        const result = await search(input)
        assert.equal(result.kind, scenario === "clear" ? "not_found" : scenario === "crisis" ? "safeguarding" : "refused")
      } else {
        const suggest = createSuggestTerm({ checkInputSafety: gate, recordSuggestion: async () => {
          calls.push("suggestion"); return { merged: false }
        } })
        assert.equal((await suggest(input)).success, scenario === "clear")
      }
      assert.equal(events.length, 1)
      assert.deepEqual(events[0], {
        outcome: scenario === "clear" ? "safe" : scenario === "crisis" ? "safeguarding" : "refuse",
        categories: scenario === "crisis" ? ["suicide_self_harm"] : [], recordedAt,
      })
      assert.deepEqual(calls, scenario === "crisis" ? ["event"] : scenario === "outage" ? ["moderation", "event"] :
        surface === "search" ? ["moderation", "event", "lookup", "usage", "discovery"] : ["moderation", "event", "suggestion"])
    })
  }
}

test("invalid form inputs do not create evaluated events", async () => {
  let writes = 0
  const gate = createTrackedSafetyGate(async () => verdict("safe"), async () => { writes++ }, now)
  const suggest = createSuggestTerm({ checkInputSafety: gate, recordSuggestion: async () => { assert.fail("No suggestion expected") } })
  await suggest("x")
  await suggest("rizz", "x".repeat(501))
  assert.equal(writes, 0)
})
