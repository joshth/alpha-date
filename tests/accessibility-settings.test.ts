import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import {
  applyPreset,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  loadPreferences,
  resolvePreferences,
  savePreferences,
  shouldToggleHighContrast,
  updatePreference,
} from "../components/accessibility/preferences"

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

test("a visible top-right accessibility symbol opens the settings panel", () => {
  const trigger = markup.match(/<button(?=[^>]*aria-label="Accessibility options")(?=[^>]*aria-controls="accessibility-options")[^>]*>/)
  assert.ok(trigger, "the icon button has an accessible name and controls the settings panel")
  assert.match(trigger[0], /fixed right-4 top-24/, "the icon button is fixed at the right edge, below the header")
  assert.match(markup, /<svg[^>]*aria-hidden="true"/, "the symbol is decorative to assistive technology")
})

test("presets change the intended settings and individual edits become custom", () => {
  const vision = applyPreset("Vision")
  assert.equal(vision.highContrast, true)
  assert.equal(vision.textSize, 125)
  const motor = applyPreset("Motor")
  assert.equal(motor.calmMotion, true)
  assert.equal(motor.largeControls, true)
  const reading = applyPreset("Reading")
  assert.equal(reading.font, "opendyslexic")
  assert.equal(reading.lineSpacing, "wide")
  assert.equal(updatePreference(vision, "textSize", 150).preset, "Custom")
})

test("unset motion, contrast and theme follow the OS preferences", () => {
  assert.deepEqual(resolvePreferences(DEFAULT_ACCESSIBILITY_PREFERENCES, {
    reducedMotion: true, highContrast: true, darkTheme: true,
  }), { ...DEFAULT_ACCESSIBILITY_PREFERENCES, calmMotion: true, highContrast: true, darkTheme: true })
})

test("blocked or invalid storage leaves usable defaults and shortcut handling stays out of text fields", () => {
  const blocked = { getItem() { throw new Error("blocked") }, setItem() { throw new Error("blocked") }, removeItem() { throw new Error("blocked") } }
  assert.deepEqual(loadPreferences(blocked), DEFAULT_ACCESSIBILITY_PREFERENCES)
  assert.equal(savePreferences(blocked, DEFAULT_ACCESSIBILITY_PREFERENCES), false)
  assert.equal(shouldToggleHighContrast({ key: "h", ctrlKey: true, shiftKey: true, target: { tagName: "INPUT" } }), false)
  assert.equal(shouldToggleHighContrast({ key: "H", metaKey: true, shiftKey: true, target: { tagName: "BODY" } }), true)
})

test("preset contents and OS defaults are documented", () => {
  const path = "docs/features/accessibility-settings.md"
  assert.ok(existsSync(path), "the accessibility settings guide exists")
  const guide = readFileSync(path, "utf8")
  for (const detail of ["Vision", "Motor", "Reading", "System preferences", "Ctrl", "Shift", "H"]) {
    assert.ok(guide.includes(detail), `${detail} is explained in the guide`)
  }
})
