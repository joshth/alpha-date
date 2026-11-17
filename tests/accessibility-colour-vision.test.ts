import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { accessibilityInitScript } from "../components/accessibility/preferences"

const css = readFileSync("app/globals.css", "utf8")
const stages = ["emerging", "peaking", "declining", "parent-territory"]

test("saved colour vision mode is applied before hydration and rejects unknown modes", () => {
  const script = accessibilityInitScript()
  assert.match(script, /data-color-vision/)
  assert.match(script, /protanopia.*deuteranopia.*tritanopia/)
  assert.match(script, /p\.colorVision\)?\?p\.colorVision:"standard"/)
})

test("each colour vision mode defines distinct Aura stage colours", () => {
  for (const mode of ["protanopia", "deuteranopia", "tritanopia"]) {
    const block = css.match(new RegExp(`html\\[data-color-vision="${mode}"\\][^{}]*\\.lab\\s*\\{([^}]*)\\}`))?.[1]
    assert.ok(block, `${mode} has a Lab palette`)
    const values = stages.map((stage) => block.match(new RegExp(`--lab-stage-${stage}:\\s*([^;]+);`))?.[1])
    assert.ok(values.every(Boolean), `${mode} defines all four stage colours`)
    assert.equal(new Set(values).size, 4, `${mode} has four distinct stage colours`)
    assert.ok((css.match(new RegExp(`data-color-vision="${mode}"`, "g")) ?? []).length >= 3, `${mode} supports dark, explicit light and system light themes`)
  }
})

test("high contrast wins over colour vision palettes", () => {
  assert.match(css, /data-color-vision="protanopia"[^{}]*:not\(\[data-high-contrast="true"\]\)/)
  assert.match(css, /data-color-vision="deuteranopia"[^{}]*:not\(\[data-high-contrast="true"\]\)/)
  assert.match(css, /data-color-vision="tritanopia"[^{}]*:not\(\[data-high-contrast="true"\]\)/)
})
