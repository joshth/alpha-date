import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { createSuggestTerm } from "@/lib/suggestions"
import { createInputSafetyGate } from "@/lib/safety/gate"
import type { ModerationResult } from "@/lib/_stubs/moderation"

function harness(options: { status?: ModerationResult["status"]; categories?: string[]; throws?: boolean; merged?: boolean } = {}) {
  const checked: string[] = []
  const moderated: string[] = []
  const saved: { term: string; context: string | null }[] = []
  const gate = createInputSafetyGate(async (text) => {
    moderated.push(text)
    if (options.throws) throw new Error("synthetic outage")
    return { status: options.status ?? "safe", categories: options.categories ?? [], provider: "test", latencyMs: 0 }
  })
  const suggest = createSuggestTerm({
    checkInputSafety: async (text, surface) => {
      assert.equal(surface, "suggestion")
      checked.push(text)
      return gate(text, surface)
    },
    recordSuggestion: async (term, context) => {
      saved.push({ term, context })
      return { merged: options.merged ?? false }
    },
  })
  return { suggest, checked, moderated, saved }
}

for (const [term, context] of [
  ["rizz", "i want to kill myself"],
  ["i want to kill myself", "ordinary context"],
] as const) {
  test(`crisis in ${term === "rizz" ? "context" : "term"} prevents suggestion writes`, async () => {
    const { suggest, checked, moderated, saved } = harness({ throws: true })
    const result = await suggest(term, context)
    assert.equal(result.success, false)
    assert.equal(result.data?.action, "safeguarding")
    assert.deepEqual(checked, [`${term}\n${context}`])
    assert.deepEqual(moderated, [])
    assert.deepEqual(saved, [])
  })
}

for (const entry of [
  { name: "refusal", options: { status: "flagged" as const, categories: ["violence"] }, action: "refuse" },
  { name: "provider safeguarding", options: { status: "flagged" as const, categories: ["sexual/minors"] }, action: "safeguarding" },
  { name: "provider outage", options: { status: "unavailable" as const }, action: "refuse" },
  { name: "thrown provider failure", options: { throws: true }, action: "refuse" },
]) {
  test(`${entry.name} checks combined term and context without saving`, async () => {
    const { suggest, checked, moderated, saved } = harness(entry.options)
    const result = await suggest("rizz", "synthetic context")
    assert.equal(result.success, false)
    assert.equal(result.data?.action, entry.action)
    assert.deepEqual(checked, ["rizz\nsynthetic context"])
    assert.deepEqual(moderated, checked)
    assert.deepEqual(saved, [])
  })
}

for (const merged of [false, true]) {
  test(`safe ${merged ? "merged" : "new"} suggestion saves sanitised term and context once`, async () => {
    const { suggest, checked, moderated, saved } = harness({ merged })
    const result = await suggest("  rizz  ", "  ordinary context  ")
    assert.equal(result.success, true)
    assert.match(result.message, merged ? /recorded your suggestion/ : /review/)
    assert.deepEqual(checked, ["rizz\nordinary context"])
    assert.deepEqual(moderated, checked)
    assert.deepEqual(saved, [{ term: "rizz", context: "ordinary context" }])
  })
}

test("omitted context is screened and saved as null", async () => {
  const { suggest, checked, saved } = harness()
  assert.equal((await suggest("rizz")).success, true)
  assert.deepEqual(checked, ["rizz\n"])
  assert.deepEqual(saved, [{ term: "rizz", context: null }])
})

for (const term of [" ", "a"]) {
  test(`invalid term ${JSON.stringify(term)} stops before screening and storage`, async () => {
    const { suggest, checked, moderated, saved } = harness()
    assert.equal((await suggest(term, "ordinary context")).success, false)
    assert.deepEqual(checked, [])
    assert.deepEqual(moderated, [])
    assert.deepEqual(saved, [])
  })
}
