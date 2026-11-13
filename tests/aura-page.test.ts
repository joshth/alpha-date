import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const src = readFileSync("app/lab/aura/page.tsx", "utf8")

test("Aura page has Lifecycle and Dedup tabs", () => {
  assert.match(src, /<TabsTrigger value="lifecycle"/)
  assert.match(src, /<TabsTrigger value="dedup"[^>]*>\s*Dedup\s*<\/TabsTrigger>/)
  assert.match(src, /<TabsContent value="dedup"[^>]*>[\s\S]*?<DedupTab/)
  assert.match(src, /import \{[^}]*getDedupSavings[^}]*\} from "\.\.\/actions"/)
  assert.match(src, /<LifecycleTab/)
})
