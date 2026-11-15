import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const markup = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { AccessibilityControls } = require("./components/accessibility/accessibility-controls.tsx");
  console.log(renderToStaticMarkup(React.createElement(AccessibilityControls)));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })

test("accessibility panel offers presets, display settings and a live result preview", () => {
  for (const label of ["Vision", "Motor", "Reading", "Text size", "Line spacing", "Font", "Calm motion", "High contrast", "Reset to defaults", "Preview"]) {
    assert.ok(markup.includes(label), `${label} is available in the settings panel`)
  }
  assert.ok(markup.includes("rizz"), "the preview uses a real result term")
  assert.ok(markup.includes("Peaking"), "the preview includes an Aura badge")
})

test("the high-contrast shortcut is exposed to assistive technology", () => {
  assert.match(markup, /aria-keyshortcuts="Control\+Shift\+H Meta\+Shift\+H"/)
})
