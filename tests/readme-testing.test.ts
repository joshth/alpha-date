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

test("README Testing section explains mocking and the sad cases that tests cover", () => {
  const section = testingSection()
  for (const term of ["MOCK_LLM", "MOCK_MODERATION_FAILURE_RATE", "PGlite", "fail-closed", "sad case"]) {
    assert.ok(section.includes(term), `${term} missing`)
  }
})

test("README Testing section covers frontend, backend, end-to-end limits and known gaps", () => {
  const section = testingSection()
  for (const heading of ["### Frontend", "### Backend", "### End-to-end", "### Known gaps"]) {
    assert.ok(section.includes(heading), `${heading} missing`)
  }
  assert.match(section, /docker compose up --build/)
  assert.match(section, /real (AI|provider)/i)
})

test("a coverage script exists and the README quotes it with measured numbers", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"))
  assert.match(pkg.scripts["test:coverage"] ?? "", /^c8 /)
  assert.ok(pkg.devDependencies?.c8, "c8 should be a devDependency")
  const section = testingSection()
  assert.match(section, /pnpm test:coverage/)
  assert.match(section, /### Coverage/)
  // The table must hold real percentages, for example "82.4%".
  assert.ok((section.match(/\d+(\.\d+)?%/g) ?? []).length >= 3, "quote measured percentages")
})
