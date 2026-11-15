import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

test("slider thumb meets the 24px minimum target size (WCAG 2.5.8)", () => {
  const src = readFileSync("components/ui/slider.tsx", "utf8")
  const cls = src.match(/<SliderPrimitive\.Thumb[^>]*className="([^"]*)"/)?.[1] ?? ""
  assert.ok(cls, "thumb className found")
  const tokens = cls.split(/\s+/)
  assert.ok(tokens.includes("h-6") && tokens.includes("w-6"), "h-6 w-6")
  assert.ok(!tokens.includes("h-4") && !tokens.includes("w-4"), "no h-4/w-4")
})

// axe: aria-label is prohibited on the generic root <span>; Radix puts role="slider" on the thumb, so the name belongs there.
test("the slider's accessible name goes on the thumb only, not on the generic root element", () => {
  const src = readFileSync("components/ui/slider.tsx", "utf8")
  const name = src.match(/\(\{\s*className,\s*"aria-label":\s*(\w+),\s*\.\.\.props\s*\}/)?.[1]
  assert.ok(name, "aria-label is taken out of props before they are spread onto the root")
  assert.match(src, new RegExp(`<SliderPrimitive\\.Thumb[^>]*aria-label=\\{${name}\\}`))
})
