import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { accessibilityInitScript } from "../components/accessibility/preferences"
import { readFileSync } from "node:fs"

test("the accessibility bootstrap applies saved and OS-aware settings before hydration", () => {
  const script = accessibilityInitScript()
  for (const token of [
    "localStorage",
    "alpha-date-accessibility-v1",
    "prefers-reduced-motion",
    "prefers-contrast",
    "data-high-contrast",
    "data-text-size",
    "data-accessibility-font",
    "data-line-spacing",
    "data-calm-motion",
    "data-large-controls",
  ]) assert.ok(script.includes(token), `${token} is handled before hydration`)
  assert.match(script, /try\{/)
  assert.match(script, /catch\(_\)/)
})

test("the root layout runs the bootstrap and suppresses expected body hydration differences", () => {
  const layout = readFileSync("app/layout.tsx", "utf8")
  assert.match(layout, /accessibilityInitScript/)
  assert.match(layout, /dangerouslySetInnerHTML/)
  assert.match(layout, /<body[^>]*suppressHydrationWarning/)
})
