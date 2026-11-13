import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { findLikelyMatches } from "@/lib/normalise"
import { DATA_BEGIN } from "@/lib/mcp/data"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, getTermEvents, listPublishedTermNames, saveDiscoveredTerm } from "@/lib/terms-store"
import { createDecoderTools } from "@/lib/mcp/tools"

const tools = createDecoderTools({
  checkInputSafety,
  getTermByKey,
  listPublishedTermNames,
  getTermEvents,
  scoreTermLifecycle: () => ({ stage: "peaking", confidence: 0.9, explanation: "At 95% of its 180-day peak, level over 180 days." }),
  now: () => new Date("2026-11-01T00:00:00.000Z"),
})

test("an unknown term says not found and lists up to 3 likely matches", async () => {
  const expected = findLikelyMatches("rizzler", await listPublishedTermNames())
    .slice(0, 3)
    .map((m) => m.candidate)
  assert.ok(expected.length > 0, "rizzler should have at least one likely match")
  const out = await tools.lookupTerm("rizzler")
  assert.equal(out.split("\n")[0], "rizzler: not found")
  assert.ok(out.split("\n").includes(`Likely matches: ${expected.join(", ")}`), out)
  assert.ok(!out.includes(DATA_BEGIN), out)
})

test("with no close match the answer says so and has no Likely matches line", async () => {
  const out = await tools.lookupTerm("qqqqzzzz")
  assert.equal(out.split("\n")[0], "qqqqzzzz: not found")
  assert.ok(out.includes("No close matches in the lexicon."), out)
  assert.ok(!out.includes("Likely matches"), out)
})

test("a pending_review term is not found and its definition is never shown", async () => {
  await saveDiscoveredTerm({
    id: "pending-1",
    term: "Zorbify",
    definition: "SECRET pending definition",
    examples: [],
    originAndContext: "",
    commonSentiment: "Neutral",
    sensitivityRating: "Generally Harmless",
  })
  const out = await tools.lookupTerm("zorbify")
  assert.equal(out.split("\n")[0], "zorbify: not found")
  assert.ok(!out.includes("SECRET"), out)
  assert.ok(!out.includes(DATA_BEGIN), out)
})
