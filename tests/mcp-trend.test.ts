import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import type { AuraFitResult } from "@/lib/aura/fit"
import { EXPLANATION, fitResult, noFit } from "./mcp-fit-fixture"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, listPublishedTermNames } from "@/lib/terms-store"
import { createDecoderTools } from "@/lib/mcp/tools"

function makeTools(result: AuraFitResult) {
  return createDecoderTools({
    checkInputSafety,
    getTermByKey,
    listPublishedTermNames,
    fitAuraTerm: async () => result,
  })
}

test("getAuraTrend gives the stage, the explanation, then 26 weekly values", async () => {
  const lines = (await makeTools(fitResult()).getAuraTrend("rizz")).split("\n")
  assert.equal(lines[0], "Rizz: Peaking, high confidence")
  assert.equal(lines[1], EXPLANATION)
  const result = fitResult()
  if (result.kind !== "fit") throw new Error("missing fit")
  const series = result.fit
  const trend = `Observed interest, oldest first, 0 to 1: ${series.counts.map((v) => v.toFixed(2)).join(", ")}`
  assert.ok(lines.includes(trend), lines.join("\n"))
  assert.ok(lines.some((line) => line.startsWith("Fitted interest, oldest first")))
})

test("getAuraTrend with no score has no Weekly trend line", async () => {
  const out = await makeTools(noFit).getAuraTrend("rizz")
  assert.equal(out.split("\n")[0], "Rizz: No stage yet")
  assert.ok(!out.includes("Weekly trend"), out)
})
