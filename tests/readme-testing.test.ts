import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

// Text of the "## Testing" section, up to the next "## " heading.
const testingSection = () =>
  /^## Testing$([\s\S]*?)(?=^## )/m.exec(readFileSync("README.md", "utf8"))?.[1] ?? ""

test("README has a Testing section that says how to run every test layer", () => {
  const section = testingSection()
  assert.match(section, /pnpm test\b/)
  assert.match(section, /pnpm test:ci/)
  assert.match(section, /pytest/)
})

test("README Testing section names the test layers and the files that cover each", () => {
  const section = testingSection()
  for (const layer of ["Unit", "Integration", "Safety evaluation", "End-to-end"]) {
    assert.ok(section.includes(layer), `${layer} layer missing`)
  }
  // Each named file must exist, so the README cannot point at a deleted test.
  const files = [...section.matchAll(/`(tests\/[\w.-]+\.test\.ts|sirs\/tests\/[\w.-]+\.py)`/g)].map((m) => m[1])
  assert.ok(files.length >= 6, "name at least six example test files")
  for (const file of files) assert.ok(existsSync(file), `${file} does not exist`)
})
