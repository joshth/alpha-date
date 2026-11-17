import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { searchDemo } from "@/lib/dedup/search-demo"

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
