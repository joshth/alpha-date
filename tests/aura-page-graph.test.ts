import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const tab = readFileSync("components/aura/dedup-tab.tsx", "utf8")
const page = readFileSync("app/lab/dedup/page.tsx", "utf8")

test("DedupTab takes graphAction and renders GraphExplorer below the counter", () => {
  assert.match(tab, /function DedupTab\(\{[^}]*graphAction[^}]*\}\s*:\s*\{[\s\S]*?graphAction\s*:/)
  assert.match(tab, /<GraphExplorer\s+graphAction=\{graphAction\}/)
  assert.ok(tab.indexOf("<GraphExplorer") > tab.indexOf("<DedupResult"), "explorer after counter")
  assert.match(tab, /from "@\/components\/aura\/similarity-graph-explorer"/)
})

test("the Dedup page wires getDedupGraph into DedupTab", () => {
  assert.match(page, /<DedupTab[^>]*graphAction=\{getDedupGraph\}/)
  assert.match(page, /getDedupGraph/)
})

test("the page hands the semantic edges action to the Dedup tab, which passes it to the explorer", () => {
  assert.match(page, /import \{[^}]*getSemanticEdges[^}]*\} from "\.\.\/actions"/)
  assert.match(page, /<DedupTab[^>]*semanticAction=\{getSemanticEdges\}/)
  assert.match(tab, /semanticAction\??\s*:/)
  assert.match(tab, /<GraphExplorer[^>]*semanticAction=\{semanticAction\}/)
})
