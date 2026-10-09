import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { count, eq } from "drizzle-orm"
import { getDb } from "@/lib/_stubs/db"
import { termEvents, termFeedback, terms } from "@/lib/_stubs/schema"
import { SYNTHETIC_SHAPES } from "@/lib/_stubs/fixtures/synthetic"
import { discoverTerm, toDiscoveredTerm } from "@/lib/discovery/discover"
import { recordSuggestion, listSuggestions } from "@/lib/feedback"
import { getTermRecord, saveDiscoveredTerm, setTermStatus } from "@/lib/terms-store"
import { slangDatabase } from "@/lib/lexicon-data"

test("seed: published lexicon, pending AI terms, anonymous events, suggestions", async () => {
  const db = await getDb()
  const [{ value: published }] = await db.select({ value: count() }).from(terms).where(eq(terms.status, "published"))
  assert.equal(published, slangDatabase.length)
  const [{ value: pending }] = await db.select({ value: count() }).from(terms).where(eq(terms.status, "pending_review"))
  assert.ok(pending >= 3)
  const [{ value: events }] = await db.select({ value: count() }).from(termEvents)
  assert.ok(events > 5000, `expected a realistic event history, got ${events}`)
  const [{ value: suggestions }] = await db.select({ value: count() }).from(termFeedback)
  assert.ok(suggestions >= 20)
})

test("synthetic shapes reference real seed-lexicon terms", () => {
  const names = new Set(slangDatabase.map((t) => t.term.toLowerCase()))
  for (const key of Object.keys(SYNTHETIC_SHAPES)) assert.ok(names.has(key), key)
})

test("discovery post-processing: no definition means no term, name is the user's search", () => {
  assert.equal(toDiscoveredTerm("abc", { isLegit: true }), null)
  assert.equal(toDiscoveredTerm("abc", { isLegit: false, definition: "x" }), null)
  const term = toDiscoveredTerm("Brainrot", { isLegit: true, definition: " Low-quality content. " })!
  assert.equal(term.term, "Brainrot")
  assert.equal(term.definition, "Low-quality content.")
  assert.equal(term.sensitivityRating, "Use With Caution", "missing rating defaults to caution")
})

test("discovery uses the injected model and prompt", async () => {
  let seenPrompt = ""
  const result = await discoverTerm(
    "glazing",
    async ({ prompt }) => {
      seenPrompt = prompt
      return { isLegit: true, definition: "Over-praising someone." }
    },
    (q) => `custom prompt for ${q}`,
  )
  assert.equal(seenPrompt, "custom prompt for glazing")
  assert.equal(result?.term.definition, "Over-praising someone.")
})

test("discovered terms are stored for review and never overwrite existing rows", async () => {
  const first = await saveDiscoveredTerm(toDiscoveredTerm("yapping", { isLegit: true, definition: "Talking a lot." })!)
  assert.equal(first?.status, "pending_review")
  const again = await saveDiscoveredTerm(toDiscoveredTerm("yapping", { isLegit: true, definition: "Different." })!)
  assert.equal(again, null)
  assert.equal((await getTermRecord("yapping"))?.term.definition, "Talking a lot.")
  assert.equal(await setTermStatus(first!.id, "published"), true)
  assert.equal(await setTermStatus(first!.id, "rejected"), false, "only pending terms can be reviewed")
})

test("baseline suggestion dedup is exact-match only (what normalisation must improve)", async () => {
  await recordSuggestion("Skrrt", null)
  const merged = await recordSuggestion("  skrrt ", null)
  assert.equal(merged.merged, true)
  await recordSuggestion("skrt", null)
  const rows = (await listSuggestions()).filter((s) => s.suggestedTerm.startsWith("skr"))
  assert.equal(rows.length, 2, "baseline keeps 'skrt' separate from 'skrrt'")
})
