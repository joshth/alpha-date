import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const layout = readFileSync("app/layout.tsx", "utf8")

test("the first two page controls offer search, then accessibility options", () => {
  const search = layout.indexOf('href="#lab-search"')
  const options = layout.indexOf("Accessibility options")

  assert.ok(search >= 0, 'the first skip link targets the Lab search field')
  assert.ok(options > search, "the accessibility options entry follows the search link")
  assert.ok(layout.includes('focus:not-sr-only'), "both links become visible on focus")
})
