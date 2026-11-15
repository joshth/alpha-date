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

test("both tabs stay mounted so a fit is not lost when switching tabs", () => {
  for (const v of ["lifecycle", "dedup"]) {
    const tag = src.match(new RegExp(`<TabsContent value="${v}"[^>]*>`))?.[0] ?? ""
    assert.match(tag, /\bforceMount\b/, `${v} content is force-mounted`)
    assert.match(tag, /data-\[state=inactive\]:hidden/, `${v} content is hidden, not unmounted, when inactive`)
  }
})
