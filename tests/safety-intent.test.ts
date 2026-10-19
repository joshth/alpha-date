import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadGoldenSet } from "@/lib/eval/golden"
import { assessSafety } from "@/lib/safety/classify"
import { createInputSafetyGate } from "@/lib/safety/gate"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"

const cases = loadGoldenSet().cases.filter((entry) => entry.kind === "safety" &&
  entry.source === "synthetic-intent-regression")

test("intent regressions have unique labelled IDs", () => {
  assert.equal(cases.length, 14)
  assert.equal(new Set(cases.map((entry) => entry.id)).size, cases.length)
})

for (const entry of cases) {
  if (entry.kind !== "safety") continue
  test(`intent regression: ${entry.id}`, async () => {
    const assessment = assessSafety(entry.input)
    assert.equal(assessment.crisis, entry.safety.crisis ?? null, entry.id)
    assert.deepEqual([...assessment.categories].sort(), [...entry.safety.categories].sort(), entry.id)

    let providerCalls = 0
    const gate = createInputSafetyGate(async () => {
      providerCalls++
      return { status: "safe", categories: [], provider: "test", latencyMs: 0 }
    })
    for (const surface of ["search", "suggestion"] as const) {
      const verdict = await gate(entry.input, surface)
      assert.equal(verdict.action, entry.safety.action, entry.id)
      assert.equal(verdict.crisis, entry.safety.crisis ?? null, entry.id)
    }
    assert.equal(providerCalls, entry.safety.action === "safeguarding" ? 0 : 2)
  })
}

test("corrected self-harm verdict blocks search dependencies and suggestion storage", async () => {
  const entry = cases.find((entry) => entry.id === "intent-001")
  assert.ok(entry)
  const calls: string[] = []
  const gate = createInputSafetyGate(async () => {
    calls.push("moderation")
    throw new Error("must not reach moderation")
  })
  const blocked = async () => { calls.push("downstream"); throw new Error("must not reach storage") }
  const search = createSearchTerm({
    checkInputSafety: gate, getTermRecord: blocked, logTermEvent: blocked,
    generateDiscoveryObject: blocked, saveDiscoveredTerm: blocked,
  })
  const suggestion = createSuggestTerm({ checkInputSafety: gate, recordSuggestion: blocked })
  const found = await search(entry.input)
  assert.equal(found.kind, "safeguarding")
  if (found.kind === "safeguarding") assert.equal(found.verdict.crisis, "self_harm")
  const submitted = await suggestion("rizz", entry.input)
  assert.equal(submitted.success, false)
  assert.equal(submitted.data?.action, "safeguarding")
  assert.equal(submitted.data?.crisis, "self_harm")
  assert.deepEqual(calls, [])
})
