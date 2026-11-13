import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import type { AuraScore } from "@/lib/aura"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"
import { createDecoderTools } from "@/lib/mcp/tools"

const EXPLANATION = "At 95% of its 180-day peak, level over 180 days."

function makeTools(score: AuraScore | null) {
  return createDecoderTools({
    checkInputSafety,
    getTermByKey,
    listPublishedTermNames,
    getTermEvents,
    scoreTermLifecycle: () => score,
    now: () => new Date("2026-11-01T00:00:00.000Z"),
  })
}

test("getAura gives the stage line then the explanation", async () => {
  const lines = (await makeTools({ stage: "peaking", confidence: 0.9, explanation: EXPLANATION }).getAura("rizz")).split("\n")
  assert.equal(lines[0], "Rizz: Peaking, high confidence")
  assert.equal(lines[1], EXPLANATION)
})

test("getAura with no score says there is too little data", async () => {
  const lines = (await makeTools(null).getAura("rizz")).split("\n")
  assert.equal(lines[0], "Rizz: No stage yet")
  assert.ok(lines.includes("There is too little search data to give a stage."), lines.join("\n"))
})

test("getAura for an unknown term says not found", async () => {
  const out = await makeTools({ stage: "peaking", confidence: 0.9, explanation: EXPLANATION }).getAura("qqqqzzzz")
  assert.equal(out.split("\n")[0], "qqqqzzzz: not found")
})
