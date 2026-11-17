import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const file = "app/lab/dedup/page.tsx"
const src = existsSync(file) ? readFileSync(file, "utf8") : ""

test("the Dedup page has its own title and heading, and shows the dedup counter and graph", () => {
  assert.match(src, /export const metadata = \{ title: "Dedup" \}/)
  assert.match(src, /<h1[^>]*>Dedup<\/h1>/)
  assert.match(src, /<DedupTab[^>]*savingsAction=\{getDedupSavings\}[^>]*graphAction=\{getDedupGraph\}[^>]*semanticAction=\{getSemanticEdges\}/)
  assert.match(src, /import \{[^}]*getDedupSavings[^}]*getSemanticEdges[^}]*\} from "\.\.\/actions"/)
})

test("the Dedup page has a search box over the lexicon terms", () => {
  assert.match(src, /import \{ DedupSearch \} from "@\/components\/aura\/dedup-search"/)
  assert.match(src, /<DedupSearch candidates=\{/)
  assert.match(src, /listPublishedTermNames\(\)/)
})

test("the Dedup page feeds the search box every database word, not only the lexicon", () => {
  assert.match(src, /readDedupRows\(\)/)
  assert.match(src, /searchCandidates\(/)
  assert.ok(!src.includes("const DEMO_TERMS"))
})
