import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { createSearchTerm } from "@/lib/search"
import { createInputSafetyGate } from "@/lib/safety/gate"
import { toDiscoveredTerm } from "@/lib/discovery/discover"
import type { ModerationResult } from "@/lib/_stubs/moderation"
import type { TermRecord } from "@/lib/terms-store"

function harness(options: { status?: ModerationResult["status"]; categories?: string[]; throws?: boolean; existing?: TermRecord; legit?: boolean } = {}) {
  const calls: string[] = []
  const gate = createInputSafetyGate(async () => {
    calls.push("moderation")
    if (options.throws) throw new Error("synthetic outage")
    return { status: options.status ?? "safe", categories: options.categories ?? [], provider: "test", latencyMs: 0 }
  })
  const search = createSearchTerm({
    checkInputSafety: async (query, surface) => {
      calls.push(`gate:${surface}:${query}`)
      return gate(query, surface)
    },
    getTermRecord: async () => { calls.push("lookup"); return options.existing ?? null },
    logTermEvent: async (_query, event) => { calls.push(`event:${event}`) },
    generateDiscoveryObject: async () => {
      calls.push("discovery")
      return { isLegit: options.legit ?? true, definition: "Synthetic definition." }
    },
    saveDiscoveredTerm: async () => { calls.push("save"); return null },
  })
  return { search, calls }
}

for (const entry of [
  { name: "harmful refusal", options: { status: "flagged" as const, categories: ["violence"] }, kind: "refused" },
  { name: "provider safeguarding", options: { status: "flagged" as const, categories: ["sexual/minors"] }, kind: "safeguarding" },
  { name: "unavailable provider", options: { status: "unavailable" as const }, kind: "refused" },
  { name: "thrown provider failure", options: { throws: true }, kind: "refused" },
]) {
  test(`${entry.name} stops search before lookup, discovery and writes`, async () => {
    const { search, calls } = harness(entry.options)
    assert.equal((await search("synthetic input")).kind, entry.kind)
    assert.deepEqual(calls, ["gate:search:synthetic input", "moderation"])
  })
}

test("crisis search skips moderation and every downstream dependency", async () => {
  const { search, calls } = harness({ throws: true })
  assert.equal((await search("i want to kill myself")).kind, "safeguarding")
  assert.deepEqual(calls, ["gate:search:i want to kill myself"])
})

test("blank input stops before the gate", async () => {
  const { search, calls } = harness()
  assert.equal((await search("  ")).kind, "error")
  assert.deepEqual(calls, [])
})

test("safe discovery checks sanitised input before lookup and writes", async () => {
  const { search, calls } = harness()
  const result = await search("  rizz  ")
  assert.equal(result.kind, "discovered")
  if (result.kind === "discovered") assert.equal(result.term.term, "rizz")
  assert.deepEqual(calls, ["gate:search:rizz", "moderation", "lookup", "event:search_miss", "discovery", "save", "event:llm_generated"])
})

for (const status of ["published", "pending_review", "rejected"] as const) {
  test(`safe ${status} lookup does not regenerate or save the term`, async () => {
    const existing: TermRecord = {
      id: "fixture", term: toDiscoveredTerm("rizz", { isLegit: true, definition: "Synthetic definition." })!,
      status, source: "test", createdAt: "2026-10-12T00:00:00Z",
    }
    const { search, calls } = harness({ existing })
    const result = await search("rizz")
    assert.equal(result.kind, status === "published" ? "found" : status === "pending_review" ? "discovered" : "not_found")
    assert.deepEqual(calls, ["gate:search:rizz", "moderation", "lookup", ...(status === "pending_review" ? [] : [`event:${status === "published" ? "search_hit" : "search_miss"}`])])
  })
}

test("safe discovery with no legitimate result does not save a term", async () => {
  const { search, calls } = harness({ legit: false })
  assert.equal((await search("rizz")).kind, "not_found")
  assert.deepEqual(calls, ["gate:search:rizz", "moderation", "lookup", "event:search_miss", "discovery"])
})
