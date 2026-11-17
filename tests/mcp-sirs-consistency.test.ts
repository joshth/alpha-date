import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"
import { createDecoderTools } from "@/lib/mcp/tools"

const fit = {
  term: "Rizz", generation: "gen_alpha", modelVersion: "test", now: "2026-11-01",
  weeks: ["2026-10-18", "2026-10-25", "2026-11-01"], counts: [0.5, 1, 0.3],
  fitted: { I: [0.6, 1, 0.25], S: [0.4, 0.3, 0.5], R: [0, 0.1, 0.2], Gamma: [0.1, 0.1, 0.1] },
  r: 0.25, delta: -0.3, stage: "declining" as const, confidence: 0.9,
  peakWeek: "2026-10-25", windowStart: "2026-05-05",
}

test("all MCP answers use the dashboard SIRS stage and explanation", async () => {
  const deps = {
    checkInputSafety, getTermByKey, listPublishedTermNames, getTermEvents,
    scoreTermLifecycle: () => ({ stage: "peaking" as const, confidence: 0.9, explanation: "Old scorer." }),
    fitAuraTerm: async () => ({ kind: "fit" as const, fit, source: "vendored" as const, stageNote: null }),
    now: () => new Date("2026-11-01T00:00:00.000Z"),
  }
  const tools = createDecoderTools(deps)
  const lookup = await tools.lookupTerm("rizz")
  const aura = await tools.getAura("rizz")
  const trend = await tools.getAuraTrend("rizz")
  for (const output of [lookup, aura, trend]) {
    assert.equal(output.split("\n")[0], "Rizz: Declining, high confidence")
    assert.match(output, /Down 75% from its peak, down 30 points in the last 180 days\./)
  }
  assert.match(trend, /Observed interest, oldest first, 0 to 1: 0\.50, 1\.00, 0\.30/)
  assert.match(trend, /Fitted interest, oldest first, 0 to 1: 0\.60, 1\.00, 0\.25/)
})
