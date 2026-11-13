import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { DATA_BEGIN } from "@/lib/mcp/data"
import { checkInputSafety, type SafetyVerdict } from "@/lib/safety/gate"
import { resourcesFor } from "@/lib/safety/resources"
import { safetyResponseMessage } from "@/lib/safety/responses"
import { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"
import { createDecoderTools } from "@/lib/mcp/tools"

const verdicts: SafetyVerdict[] = [
  { action: "safeguarding", categories: ["suicide_self_harm"], crisis: "self_harm", decidedBy: "rules", reason: "crisis:self_harm" },
  { action: "refuse", categories: ["bullying_harassment"], crisis: null, decidedBy: "moderation", reason: "moderation_flagged" },
]

function makeTools(gate: typeof checkInputSafety) {
  const spy = { scored: 0 }
  const tools = createDecoderTools({
    checkInputSafety: gate,
    getTermByKey,
    listPublishedTermNames,
    getTermEvents,
    scoreTermLifecycle: () => {
      spy.scored++
      return { stage: "peaking", confidence: 0.9, explanation: "x" }
    },
    now: () => new Date("2026-11-01T00:00:00.000Z"),
  })
  return { tools, spy }
}

for (const verdict of verdicts) {
  test(`every tool answers a ${verdict.action} verdict with the safety message and resources only`, async () => {
    const { tools, spy } = makeTools(async () => verdict)
    // The message is never cut mid-sentence: its first sentence leads, and the whole message follows.
    const message = safetyResponseMessage(verdict, "search")
    const first = message.slice(0, message.indexOf(".") + 1)
    for (const tool of [tools.lookupTerm, tools.getAura, tools.getAuraTrend]) {
      const out = await tool("rizz")
      assert.equal(out.split("\n")[0], first, out)
      assert.ok(out.split("\n")[0].length <= 80, out)
      assert.ok(out.includes(message.slice(first.length).trim()), out)
      for (const r of resourcesFor(verdict.categories)) {
        assert.ok(out.includes(r.name), `${r.name} missing from: ${out}`)
        if (r.phone) assert.ok(out.includes(r.phone), `${r.phone} missing from: ${out}`)
      }
      assert.ok(!out.includes(DATA_BEGIN), out)
    }
    assert.equal(spy.scored, 0)
  })
}

test("the real safety gate is called with the query", async () => {
  const calls: string[] = []
  const { tools } = makeTools(async (text, surface) => {
    calls.push(text)
    return checkInputSafety(text, surface)
  })
  await tools.lookupTerm("rizz")
  assert.equal(calls[0], "rizz")
})
