import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const layout = readFileSync("app/layout.tsx", "utf8")
const controls = readFileSync("components/accessibility/accessibility-controls.tsx", "utf8")

test("the first two page controls offer search, then accessibility options", () => {
  const search = controls.indexOf('href="#lab-search"')
  const options = controls.indexOf("Accessibility options")

  assert.ok(search >= 0, 'the first skip link targets the Lab search field')
  assert.ok(options > search, "the accessibility options entry follows the search link")
  assert.ok(controls.includes('focus:not-sr-only'), "both links become visible on focus")
})

test("the root page mounts the interactive accessibility controls", () => {
  assert.match(layout, /AccessibilityControls/)
})

test("the launcher draws the blue circle and white figure from the slides' accessibility icon, not a library glyph", () => {
  assert.ok(!controls.includes('from "lucide-react"') || !/Accessibility as AccessibilityIcon/.test(controls), "no lucide Accessibility glyph")
  assert.ok(controls.includes('viewBox="0 0 820 820"'))
  assert.ok(controls.includes('<circle cx="410" cy="410" r="400" fill="#139fda"'))
  assert.ok(controls.includes('<circle cx="410" cy="223" r="46"'))
  assert.ok(controls.includes("M222 287 L598 287"))
})

test("the launcher and its panel sit below the Lab header, clear of the top-right controls", () => {
  const classes = [...controls.matchAll(/className=\{?`?"?([^"`}]*fixed right-4[^"`}]*)/g)].map((m) => m[1])
  assert.equal(classes.length, 2, "launcher and panel")
  for (const c of classes) assert.ok(/\btop-24\b/.test(c) && !/\btop-4\b/.test(c), c)
})
