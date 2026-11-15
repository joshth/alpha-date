import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const search = readFileSync("components/search/search-panel.tsx", "utf8")
const auraPage = readFileSync("app/lab/aura/page.tsx", "utf8")

test("found and discovered search results link to Aura with the encoded query", () => {
  assert.match(search, /href=\{`\/lab\/aura\?term=\$\{encodeURIComponent\(query\)\}`\}/)
  assert.equal((search.match(/<TermCard term=\{outcome\.term\} badge=/g) ?? []).length, 2)
  assert.match(search, /badge="In the lexicon"[^>]*query=\{query\}/)
  assert.match(search, /badge="AI-discovered"[^>]*query=\{query\}/)
})

test("Aura page passes its term search param to LifecycleTab", () => {
  assert.match(auraPage, /const term = params\.term/)
  assert.match(auraPage, /<LifecycleTab fitAction=\{fitAuraTerm\} initialTerm=\{initialTerm\}/)
})
