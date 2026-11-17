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

test("getAura gives the stage line then the explanation", async () => {
  const lines = (await makeTools(fitResult()).getAura("rizz")).split("\n")
  assert.equal(lines[0], "Rizz: Peaking, high confidence")
  assert.equal(lines[1], EXPLANATION)
})

test("getAura with no score says there is too little data", async () => {
  const lines = (await makeTools(noFit).getAura("rizz")).split("\n")
  assert.equal(lines[0], "Rizz: No stage yet")
  assert.ok(lines.includes("There is too little search data to give a stage."), lines.join("\n"))
})

test("getAura for an unknown term says not found", async () => {
  const out = await makeTools(fitResult()).getAura("qqqqzzzz")
  assert.equal(out.split("\n")[0], "qqqqzzzz: not found")
})
