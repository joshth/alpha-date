import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const tab = readFileSync("components/aura/dedup-tab.tsx", "utf8")
const page = readFileSync("app/lab/aura/page.tsx", "utf8")

test("DedupTab takes graphAction and renders GraphExplorer below the counter", () => {
  assert.match(tab, /function DedupTab\(\{[^}]*graphAction[^}]*\}\s*:\s*\{[\s\S]*?graphAction\s*:/)
  assert.match(tab, /<GraphExplorer\s+graphAction=\{graphAction\}/)
  assert.ok(tab.indexOf("<GraphExplorer") > tab.indexOf("<DedupResult"), "explorer after counter")
  assert.match(tab, /from "@\/components\/aura\/similarity-graph-explorer"/)
})

test("aura page wires getDedupGraph into DedupTab", () => {
  assert.match(page, /<DedupTab[^>]*graphAction=\{getDedupGraph\}/)
  assert.match(page, /getDedupGraph/)
})
