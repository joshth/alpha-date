import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { auraTrend, type AuraScore } from "@/lib/aura"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"
import { createDecoderTools } from "@/lib/mcp/tools"

const EXPLANATION = "At 95% of its 180-day peak, level over 180 days."
const NOW = new Date("2026-11-01T00:00:00.000Z")

function makeTools(score: AuraScore | null) {
  return createDecoderTools({
    checkInputSafety,
    getTermByKey,
    listPublishedTermNames,
    getTermEvents,
    scoreTermLifecycle: () => score,
    now: () => NOW,
  })
}

test("getAuraTrend gives the stage, the explanation, then 26 weekly values", async () => {
  const lines = (await makeTools({ stage: "peaking", confidence: 0.9, explanation: EXPLANATION }).getAuraTrend("rizz")).split("\n")
  assert.equal(lines[0], "Rizz: Peaking, high confidence")
  assert.equal(lines[1], EXPLANATION)
  const series = auraTrend(await getTermEvents("Rizz"), NOW)
  assert.equal(series.length, 26)
  const trend = `Weekly trend, oldest first, 0 to 1: ${series.map((v) => v.toFixed(2)).join(", ")}`
  assert.ok(lines.includes(trend), lines.join("\n"))
})

test("getAuraTrend with no score has no Weekly trend line", async () => {
  const out = await makeTools(null).getAuraTrend("rizz")
  assert.equal(out.split("\n")[0], "Rizz: No stage yet")
  assert.ok(!out.includes("Weekly trend"), out)
})
