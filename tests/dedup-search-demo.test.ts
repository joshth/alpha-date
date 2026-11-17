import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { searchCandidates, searchDemo } from "@/lib/dedup/search-demo"

const lexicon = ["brainrot", "skibidi", "六七"]

test("a spaced spelling gets the same key as the term", () => {
  const r = searchDemo("brain rot", lexicon)
  assert.equal(r.key, "brainrot")
  assert.deepEqual(r.matches.map((m) => [m.candidate, m.reason, m.label]), [["brainrot", "same_key", "Same key"]])
})

test("a near spelling matches by trigram", () => {
  const [m] = searchDemo("skibidii", lexicon).matches
  assert.deepEqual([m.candidate, m.reason, m.label], ["skibidi", "trigram", "Looks alike (trigram)"])
})

test("a Japanese reading with a polite ending matches by stem, best match first", () => {
  const r = searchDemo("ろくななです", lexicon)
  assert.equal(r.key, "ろくななです")
  assert.deepEqual(r.matches.map((m) => [m.candidate, m.label]), [["六七", "Same stem"]])
})

test("empty input has no key and no matches", () => {
  assert.deepEqual(searchDemo("  ", lexicon), { key: "", matches: [] })
})

test("the candidate list is every database word once: suggestions, lexicon terms and the demo terms", () => {
  const rows = [{ suggestedTerm: "glazing", count: 4 }, { suggestedTerm: "Glazing ", count: 1 }, { suggestedTerm: "rizzlr", count: 2 }]
  const list = searchCandidates(rows, ["Rizz", "glazing"])
  assert.deepEqual(list.filter((t) => ["glazing", "rizzlr", "rizz"].includes(t.trim().toLowerCase())), ["glazing", "rizzlr", "Rizz"])
  assert.ok(list.includes("六七"))
  assert.equal(new Set(list.map((t) => t.trim().toLowerCase())).size, list.length)
})

test("glaze finds glazing as a stem match from the database words", () => {
  const [m] = searchDemo("glaze", searchCandidates([{ suggestedTerm: "glazing", count: 4 }], [])).matches
  assert.deepEqual([m.candidate, m.label], ["glazing", "Same stem"])
})
