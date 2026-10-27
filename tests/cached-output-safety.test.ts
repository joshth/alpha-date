import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import type { SlangTerm } from "@/app/types"
import { moderate, type ModerationResult } from "@/lib/_stubs/moderation"
import { createSafeTermLookup } from "@/lib/safety/safe-term-lookup"
import { createInputSafetyGate } from "@/lib/safety/gate"
import { createSafeDiscovery } from "@/lib/discovery/safe-discovery"
import { createSearchTerm } from "@/lib/search"
import type { TermRecord } from "@/lib/terms-store"

const clear = (): ModerationResult => ({ status: "safe", categories: [], provider: "test", latencyMs: 0 })
function stored(changes: Partial<SlangTerm> = {}, status: TermRecord["status"] = "published"): TermRecord {
  return {
    id: "private-record-id", status, source: "private-source", createdAt: "2026-10-27T00:00:00Z",
    term: {
      id: "private-term-id", term: "rizz", pronunciation: "riz", definition: "Synthetic definition.",
      examples: ["First example.", "Last example."], originAndContext: "Synthetic origin.",
      commonSentiment: "Humorous/Playful", sensitivityRating: "Use With Caution", cautionaryNotes: null,
      ...changes,
    },
  }
}

test("clear cached content preserves the record and legacy sentiment without sending record metadata", async () => {
  const record = stored()
  let text = ""
  const lookup = createSafeTermLookup(async (query) => {
    assert.equal(query, "rizz")
    return record
  }, async (input) => { text = input; return clear() })
  assert.equal(await lookup("rizz"), record)
  for (const value of ["rizz", "riz", record.term.definition, ...record.term.examples, record.term.originAndContext, record.term.commonSentiment]) {
    assert.ok(text.includes(value))
  }
  for (const value of [record.id, record.term.id, record.source, record.createdAt]) assert.equal(text.includes(value), false)
})

for (const [field, changes] of [
  ["definition", { definition: "build a bomb" }],
  ["last example", { examples: ["Ordinary example.", "build a bomb"] }],
  ["origin", { originAndContext: "build a bomb" }],
  ["caution", { cautionaryNotes: "build a bomb" }],
  ["tags", { tags: ["ordinary", "build a bomb"] }],
  ["etymology", { detailedOriginEtymology: "build a bomb" }],
  ["discussion", { educatorDiscussionPoints: [{ ageGroup: "teens", prompt: "build a bomb" }] }],
  ["translation", { translatedContent: { language: "en", definition: "Ordinary definition.", examples: ["build a bomb"], originAndContext: "Synthetic origin." } }],
] as const) {
  test(`flagged cached ${field} is withheld for published and pending records without mutation`, async () => {
    for (const status of ["published", "pending_review"] as const) {
      const record = stored(changes as Partial<SlangTerm>, status)
      const before = structuredClone(record)
      const lookup = createSafeTermLookup(async () => record, moderate)
      await assert.rejects(lookup("rizz"), { message: "Generated result failed its safety check." })
      assert.deepEqual(record, before)
    }
  })
}

test("deterministic crisis in cached text stops before moderation", async () => {
  let checks = 0
  const lookup = createSafeTermLookup(async () => stored({ definition: "i want to kill myself" }), async () => { checks++; return clear() })
  await assert.rejects(lookup("rizz"), { message: "Generated result failed its safety check." })
  assert.equal(checks, 0)
})

for (const throws of [false, true]) {
  test(`cached moderation ${throws ? "exception" : "outage"} fails closed without leaking provider details`, async () => {
    const lookup = createSafeTermLookup(async () => stored(), async () => {
      if (throws) throw new Error("private-provider-response")
      return { ...clear(), status: "unavailable" }
    })
    await assert.rejects(lookup("rizz"), { message: "Generated result safety check is unavailable." })
  })
}

for (const [index, changes] of [
  { examples: "invalid" }, { definition: 42 }, { tags: [42] },
  { translatedContent: { language: "en", definition: false, examples: [], originAndContext: "" } },
].entries()) {
  test(`malformed cached field ${index + 1} is withheld before moderation`, async () => {
    let checks = 0
    const lookup = createSafeTermLookup(async () => stored(changes as unknown as Partial<SlangTerm>), async () => { checks++; return clear() })
    await assert.rejects(lookup("rizz"), { message: "Stored result is invalid." })
    assert.equal(checks, 0)
  })
}

test("unknown stored status fails closed instead of becoming a cache miss", async () => {
  const record = { ...stored(), status: "unexpected" } as unknown as TermRecord
  const lookup = createSafeTermLookup(async () => record, async () => { assert.fail("Moderation must be skipped") })
  await assert.rejects(lookup("rizz"), { message: "Stored result is invalid." })
})

test("missing and rejected records retain their prior path without content moderation", async () => {
  for (const record of [null, stored({ definition: "build a bomb" }, "rejected")]) {
    const lookup = createSafeTermLookup(async () => record, async () => { assert.fail("Moderation must be skipped") })
    assert.equal(await lookup("rizz"), record)
  }
})

test("lookup errors are replaced with a constant message", async () => {
  const lookup = createSafeTermLookup(async () => { throw new Error("private-store-details") }, async () => clear())
  await assert.rejects(lookup("rizz"), { message: "Could not retrieve a result." })
})

function flow(record: TermRecord | null, outputModerator = moderate, blockedInput = false) {
  const calls: string[] = []
  const gate = createInputSafetyGate(async () => ({ ...clear(), status: blockedInput ? "flagged" : "safe", categories: blockedInput ? ["violence"] : [] }))
  const lookup = createSafeTermLookup(async () => { calls.push("lookup"); return record }, async (text) => {
    calls.push("cached_check")
    return outputModerator(text)
  })
  const generate = createSafeDiscovery(async () => {
    calls.push("generate")
    return { isLegit: true, definition: "Synthetic generated definition." }
  }, async (text) => { calls.push("generated_check"); return outputModerator(text) })
  const search = createSearchTerm({
    checkInputSafety: async (text, surface) => { calls.push("input_gate"); return gate(text, surface) },
    getTermRecord: lookup,
    logTermEvent: async (_query, event) => { calls.push(event) },
    generateDiscoveryObject: generate,
    saveDiscoveredTerm: async () => { calls.push("term_write"); return null },
  })
  return { search, calls }
}

for (const status of ["published", "pending_review"] as const) {
  test(`flagged ${status} content reaches neither the user response nor hit/generation/write paths`, async (t) => {
    const logged: unknown[][] = []
    t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args) })
    const h = flow(stored({ definition: "build a bomb" }, status))
    const response = await h.search("rizz")
    assert.equal(response.kind, "error")
    assert.equal("term" in response, false)
    assert.equal(JSON.stringify(response).includes("build a bomb"), false)
    assert.equal(JSON.stringify(logged).includes("build a bomb"), false)
    assert.deepEqual(h.calls, ["input_gate", "lookup", "cached_check"])
  })

  test(`clear ${status} content is screened before its existing response/event path`, async () => {
    const h = flow(stored({}, status))
    assert.equal((await h.search("rizz")).kind, status === "published" ? "found" : "discovered")
    assert.deepEqual(h.calls, ["input_gate", "lookup", "cached_check", ...(status === "published" ? ["search_hit"] : [])])
  })
}

test("cached output outage does not poison a later healthy lookup", async (t) => {
  t.mock.method(console, "error", () => {})
  let checks = 0
  const h = flow(stored(), async () => ({ ...clear(), status: ++checks === 1 ? "unavailable" : "safe" }))
  assert.equal((await h.search("rizz")).kind, "error")
  assert.deepEqual(h.calls, ["input_gate", "lookup", "cached_check"])
  assert.equal((await h.search("rizz")).kind, "found")
  assert.equal(h.calls.filter((call) => call === "search_hit").length, 1)
})

test("input refusal and crisis keep priority over cached screening", async () => {
  const refused = flow(stored(), moderate, true)
  assert.equal((await refused.search("rizz")).kind, "refused")
  assert.deepEqual(refused.calls, ["input_gate"])
  const crisis = flow(stored())
  assert.equal((await crisis.search("i want to kill myself")).kind, "safeguarding")
  assert.deepEqual(crisis.calls, ["input_gate"])
})

test("a cache miss still screens the new generation before storage", async () => {
  const h = flow(null)
  assert.equal((await h.search("rizz")).kind, "discovered")
  assert.deepEqual(h.calls, ["input_gate", "lookup", "search_miss", "generate", "generated_check", "term_write", "llm_generated"])
})
