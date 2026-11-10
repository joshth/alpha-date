import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const scripts: Record<string, string> = JSON.parse(readFileSync("package.json", "utf8")).scripts

test("test:ci writes a JUnit report, with the reporter flags before the file list", () => {
  const command = scripts["test:ci"] ?? ""
  assert.match(command, /--test-reporter=junit --test-reporter-destination=junit\.xml/)
  // Node ignores reporter flags placed after the test files.
  assert.ok(command.indexOf("--test-reporter") < command.indexOf("tests/*.test.ts"))
})
