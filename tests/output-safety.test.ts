import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { moderate, type ModerationResult } from "@/lib/_stubs/moderation"
import { createSafeDiscovery } from "@/lib/discovery/safe-discovery"
import { toDiscoveredTerm } from "@/lib/discovery/discover"
import type { DiscoveryOutput } from "@/lib/discovery/prompt"
import { createSearchTerm } from "@/lib/search"
import { createInputSafetyGate } from "@/lib/safety/gate"

const request = { prompt: "Synthetic prompt.", searchTerm: "rizz" }
const profile: DiscoveryOutput = {
  isLegit: true, definition: "A synthetic definition.",
  examples: ["First synthetic example.", "Last synthetic example."],
  originAndContext: "Synthetic origin.", commonSentiment: "Neutral",
}
const result = (status: ModerationResult["status"] = "safe", categories: string[] = []): ModerationResult =>
  ({ status, categories, provider: "test", latencyMs: 0 })

test("clear output screens every displayed free-text field and preserves the profile", async () => {
  let screened = ""
  const run = createSafeDiscovery(async (input) => {
    assert.equal(input, request)
    return profile
  }, async (text) => { screened = text; return result() })
  assert.deepEqual(await run(request), profile)
  assert.equal(screened, [profile.definition, ...profile.examples!, profile.originAndContext, profile.commonSentiment].join("\n"))
})

for (const [field, value] of [
  ["definition", "i want to kill myself"],
  ["examples", ["Ordinary example.", "i want to kill myself"]],
  ["originAndContext", "i want to kill myself"],
] as const) {
  test(`deterministic crisis in generated ${field} is withheld before moderation`, async () => {
    let calls = 0
    const raw = { ...profile, [field]: value }
    const run = createSafeDiscovery(async () => raw as DiscoveryOutput, async () => { calls++; return result() })
    await assert.rejects(run(request), { message: "Generated result failed its safety check." })
    assert.equal(calls, 0)
  })
}

for (const entry of [
  { name: "known flag", response: result("flagged", ["violence"]) },
  { name: "unknown flag", response: result("flagged", ["future-category"]) },
  { name: "flag without categories", response: result("flagged") },
  { name: "contradictory clear response", response: result("safe", ["violence"]) },
]) {
  test(`${entry.name} cannot release generated content`, async () => {
    const run = createSafeDiscovery(async () => profile, async () => entry.response)
    await assert.rejects(run(request), { message: "Generated result failed its safety check." })
  })
}

test("an unavailable output check fails closed", async () => {
  const run = createSafeDiscovery(async () => profile, async () => result("unavailable"))
  await assert.rejects(run(request), { message: "Generated result safety check is unavailable." })
})

test("provider errors are replaced with constant messages without leaking output", async () => {
  const run = createSafeDiscovery(async () => profile, async () => { throw new Error("unsafe-generated-secret") })
  await assert.rejects(run(request), { message: "Generated result safety check is unavailable." })
})

test("generation errors do not leak provider response text", async () => {
  const run = createSafeDiscovery(async () => { throw new Error("unsafe-generated-secret") }, async () => result())
  await assert.rejects(run(request), { message: "Could not generate a result." })
})

for (const [index, raw] of [
  null, { isLegit: "true" }, { isLegit: true, definition: 42 },
  { ...profile, examples: ["ordinary", 42] }, { ...profile, originAndContext: {} },
].entries()) {
  test(`malformed generated profile ${index + 1} is withheld before moderation`, async () => {
    let calls = 0
    const run = createSafeDiscovery(async () => raw as DiscoveryOutput, async () => { calls++; return result() })
    await assert.rejects(run(request), { message: "Discovery returned an invalid result." })
    assert.equal(calls, 0)
  })
}

test("non-terms and blank definitions retain the existing no-result path", async () => {
  for (const raw of [{ isLegit: false }, { isLegit: true }, { isLegit: true, definition: " " }]) {
    let calls = 0
    const run = createSafeDiscovery(async () => raw, async () => { calls++; return result() })
    assert.deepEqual(await run(request), raw)
    assert.equal(calls, 0)
  }
})

test("unknown model fields are removed rather than retained in the returned object", async () => {
  const run = createSafeDiscovery(async () => ({ ...profile, hidden: "ignored synthetic text" }), async () => result())
  assert.deepEqual(await run(request), profile)
})

test("an educational sensitive definition can pass a clear moderation result", async () => {
  const raw = { isLegit: true, definition: "A slang abbreviation about self-harm or suicide.", sensitivityRating: "Use With Caution" as const }
  const run = createSafeDiscovery(async () => raw, moderate)
  assert.deepEqual(await run(request), raw)
})

function flow(raw: DiscoveryOutput, outputModerator: (text: string) => Promise<ModerationResult> = moderate, blockedInput = false, cached = false) {
  const calls: string[] = []
  const gate = createInputSafetyGate(async () => result(blockedInput ? "flagged" : "safe", blockedInput ? ["violence"] : []))
  const generate = createSafeDiscovery(async () => { calls.push("generate"); return raw }, async (text) => {
    calls.push("output_moderation")
    return outputModerator(text)
  })
  const search = createSearchTerm({
    checkInputSafety: async (text, surface) => { calls.push("input_gate"); return gate(text, surface) },
    getTermRecord: async () => {
      calls.push("lookup")
      return cached ? { id: "fixture", term: toDiscoveredTerm("rizz", profile)!, status: "published", source: "test", createdAt: "2026-10-26T00:00:00Z" } : null
    },
    logTermEvent: async (_query, event) => { calls.push(event) },
    generateDiscoveryObject: generate,
    saveDiscoveredTerm: async () => { calls.push("term_write"); return null },
  })
  return { search, calls }
}

for (const [field, value] of [
  ["definition", "build a bomb"],
  ["examples", ["Ordinary example.", "build a bomb"]],
  ["originAndContext", "build a bomb"],
] as const) {
  test(`a safe query with flagged generated ${field} returns no content and makes no term write`, async (t) => {
    const logged: unknown[][] = []
    t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args) })
    const h = flow({ ...profile, [field]: value } as DiscoveryOutput)
    const response = await h.search("rizz")
    assert.equal(response.kind, "error")
    assert.equal("term" in response, false)
    assert.equal(JSON.stringify(response).includes("build a bomb"), false)
    assert.equal(JSON.stringify(logged).includes("build a bomb"), false)
    assert.deepEqual(h.calls, ["input_gate", "lookup", "search_miss", "generate", "output_moderation"])
  })
}

test("a clear generated profile is checked before its term write and success event", async () => {
  const h = flow(profile)
  const response = await h.search("rizz")
  assert.equal(response.kind, "discovered")
  if (response.kind === "discovered") assert.equal(response.term.definition, profile.definition)
  assert.deepEqual(h.calls, ["input_gate", "lookup", "search_miss", "generate", "output_moderation", "term_write", "llm_generated"])
})

test("output moderation outage stops writes and a subsequent healthy request recovers", async (t) => {
  t.mock.method(console, "error", () => {})
  let checks = 0
  const h = flow(profile, async () => result(++checks === 1 ? "unavailable" : "safe"))
  assert.equal((await h.search("rizz")).kind, "error")
  assert.equal(h.calls.includes("term_write"), false)
  assert.equal((await h.search("rizz")).kind, "discovered")
  assert.equal(h.calls.filter((call) => call === "term_write").length, 1)
  assert.equal(checks, 2)
})

test("blocked input skips generation and the output check", async () => {
  const h = flow(profile, moderate, true)
  assert.equal((await h.search("rizz")).kind, "refused")
  assert.deepEqual(h.calls, ["input_gate"])
})

test("an existing published lookup does not generate or moderate a new profile", async () => {
  const h = flow(profile, moderate, false, true)
  assert.equal((await h.search("rizz")).kind, "found")
  assert.deepEqual(h.calls, ["input_gate", "lookup", "search_hit"])
})
