import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const src = readFileSync("app/lab/aura/page.tsx", "utf8")

test("the Aura page is the Lifecycle view on its own, with Dedup moved to its own page", () => {
  assert.match(src, /<LifecycleTab fitAction=\{fitAuraTerm\}/)
  assert.match(src, /<h1[^>]*>Aura<\/h1>/)
  assert.doesNotMatch(src, /DedupTab|getDedup|getSemanticEdges/, "no dedup on the Aura page")
  assert.doesNotMatch(src, /Tabs(List|Trigger|Content)?\b/, "no tab strip for a single view")
})
