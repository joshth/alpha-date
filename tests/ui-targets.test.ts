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
