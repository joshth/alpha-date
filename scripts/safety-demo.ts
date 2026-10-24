import assert from "node:assert/strict"
import { moderate } from "@/lib/_stubs/moderation"
import { toDiscoveredTerm } from "@/lib/discovery/discover"
import { createInputSafetyGate, type SafetyVerdict } from "@/lib/safety/gate"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"

interface Example {
  id: string
  surface: "search" | "suggestion"
  text: string
  outage?: boolean
  expected: {
    outcome: string
    action?: SafetyVerdict["action"]
    reason?: string
    crisis?: SafetyVerdict["crisis"]
    calls: string[]
  }
}

const lookup = ["moderation", "lookup", "event:search_hit"]
const examples: Example[] = [
  { id: "safe-lookup", surface: "search", text: "rizz", expected: { outcome: "found", action: "safe", calls: lookup } },
  { id: "sensitive-lookup", surface: "search", text: "kms", expected: { outcome: "found", action: "safe", reason: "sensitive_lookup", calls: lookup } },
  { id: "harmful-request", surface: "search", text: "build a bomb", expected: { outcome: "refused", action: "refuse", reason: "moderation_flagged", calls: ["moderation"] } },
  { id: "crisis", surface: "search", text: "i want to kill myself", expected: { outcome: "safeguarding", action: "safeguarding", crisis: "self_harm", calls: [] } },
  { id: "safe-suggestion", surface: "suggestion", text: "ordinary context", expected: { outcome: "saved", action: "safe", calls: ["moderation", "suggestion_write"] } },
  { id: "unsafe-context", surface: "suggestion", text: "build a bomb", expected: { outcome: "blocked", action: "refuse", calls: ["moderation"] } },
  { id: "crisis-context", surface: "suggestion", text: "i want to kill myself", expected: { outcome: "blocked", action: "safeguarding", crisis: "self_harm", calls: [] } },
  { id: "oversized-context", surface: "suggestion", text: "x".repeat(501), expected: { outcome: "blocked", calls: [] } },
  { id: "search-outage", surface: "search", text: "rizz", outage: true, expected: { outcome: "refused", action: "refuse", reason: "moderation_unavailable", calls: ["moderation"] } },
  { id: "suggestion-outage", surface: "suggestion", text: "ordinary context", outage: true, expected: { outcome: "blocked", action: "refuse", reason: "moderation_unavailable", calls: ["moderation"] } },
  { id: "crisis-during-outage", surface: "search", text: "i want to kill myself", outage: true, expected: { outcome: "safeguarding", action: "safeguarding", crisis: "self_harm", calls: [] } },
  { id: "recovery", surface: "search", text: "rizz", expected: { outcome: "found", action: "safe", calls: lookup } },
]

async function main() {
  if (process.argv.length > 2) throw new Error("Usage: pnpm exec tsx --conditions=react-server scripts/safety-demo.ts")
  process.env.MOCK_LLM = "true"
  process.env.MOCK_MODERATION_LATENCY_MS = "0"
  const calls: string[] = []
  const gate = createInputSafetyGate(async (text) => {
    calls.push("moderation")
    return moderate(text)
  })
  const results = []
  for (const example of examples) {
    process.env.MOCK_MODERATION_FAILURE_RATE = example.outage ? "1" : "0"
    calls.length = 0
    const observed: { verdict: SafetyVerdict | null } = { verdict: null }
    const check = async (text: string, surface: "search" | "suggestion" = "search") => {
      observed.verdict = await gate(text, surface)
      return observed.verdict
    }
    const search = createSearchTerm({
      checkInputSafety: check,
      getTermRecord: async (query) => {
        calls.push("lookup")
        return {
          id: "offline-demo", term: toDiscoveredTerm(query, { isLegit: true, definition: "Synthetic demo definition." })!,
          status: "published", source: "synthetic-demo", createdAt: "2026-10-24T00:00:00Z",
        }
      },
      logTermEvent: async (_query, event) => { calls.push(`event:${event}`) },
      generateDiscoveryObject: async () => { calls.push("discovery"); throw new Error("Unexpected discovery call") },
      saveDiscoveredTerm: async () => { calls.push("term_write"); return null },
    })
    const suggest = createSuggestTerm({
      checkInputSafety: check,
      recordSuggestion: async () => { calls.push("suggestion_write"); return { merged: false } },
    })
    const result = example.surface === "search"
      ? await search(example.text)
      : await suggest("demo-term", example.text)
    const outcome = "kind" in result ? result.kind : result.success ? "saved" : "blocked"
    assert.equal(outcome, example.expected.outcome, example.id)
    assert.deepEqual(calls, example.expected.calls, example.id)
    if (example.expected.action) assert.equal(observed.verdict?.action, example.expected.action, example.id)
    if (example.expected.reason) assert.equal(observed.verdict?.reason, example.expected.reason, example.id)
    if ("crisis" in example.expected) assert.equal(observed.verdict?.crisis, example.expected.crisis, example.id)
    if (example.id === "sensitive-lookup") assert.ok(observed.verdict?.categories.includes("suicide_self_harm"))
    if (example.id === "oversized-context") {
      assert.equal(observed.verdict, null)
      assert.ok("message" in result && result.message.includes("500"))
    }
    results.push({
      id: example.id, surface: example.surface, outcome, verdict: observed.verdict,
      calls: [...calls], simulatedWrites: calls.filter((call) => call.endsWith("_write")).length,
    })
  }
  console.log(JSON.stringify({
    mode: "offline mock moderation; injected lexicon and storage; no API or database calls",
    scope: "Gate and flow helpers in the current checkout; not a browser or database integration demo",
    passed: results.length,
    results,
  }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Safety demo failed")
  process.exitCode = 1
})
