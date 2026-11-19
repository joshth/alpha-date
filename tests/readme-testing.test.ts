import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Text of the "## Testing" section, up to the next "## " heading.
const testingSection = () =>
  /^## Testing$([\s\S]*?)(?=^## )/m.exec(readFileSync("README.md", "utf8"))?.[1] ?? ""

test("README has a Testing section that says how to run every test layer", () => {
  const section = testingSection()
  assert.match(section, /pnpm test\b/)
  assert.match(section, /pnpm test:ci/)
  assert.match(section, /pytest/)
})
