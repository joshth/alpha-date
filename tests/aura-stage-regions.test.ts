import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fittedStages } from "../lib/aura/stage-regions"

test("rolling fitted stages identify rising, peaking, declining and stable curves", () => {
  const rising = Array.from({ length: 40 }, (_, i) => i + 1)
  const peak = Array.from({ length: 40 }, (_, i) => i < 20 ? i + 1 : 20)
  const decline = Array.from({ length: 40 }, (_, i) => 40 - i)
  const stable = [...Array.from({ length: 9 }, () => 10), ...Array.from({ length: 8 }, () => 40), ...Array.from({ length: 9 }, () => 10)]
  assert.equal(fittedStages(rising).at(-1), "emerging")
  assert.equal(fittedStages(peak).at(-1), "peaking")
  assert.equal(fittedStages(decline).at(-1), "declining")
  assert.equal(fittedStages(stable).at(-1), "parent_territory")
})

test("a stage transition is assigned at the corresponding week", () => {
  const values = [...Array.from({ length: 30 }, (_, i) => i + 1), ...Array.from({ length: 20 }, (_, i) => 30 - i)]
  const stages = fittedStages(values)
  assert.equal(stages.length, values.length)
  assert.equal(stages.at(-1), "declining")
  assert.ok(stages.some((stage, i) => i > 0 && stage !== stages[i - 1]))
})

test("lifecycle chart shades fitted stages with tokens, patterns and a table alternative", () => {
  const source = readFileSync("components/aura/lifecycle-charts.tsx", "utf8")
  for (const [stage, token] of [["emerging", "stage-emerging"], ["peaking", "stage-peaking"], ["declining", "stage-declining"], ["parent_territory", "stage-parent-territory"]]) {
    assert.ok(source.includes(`key: "${stage}"`))
    assert.ok(source.includes(`token: "${token}"`))
  }
  assert.match(source, /<Area[^>]*fill=\{`url\(#aura-\$\{key\}\)`\}/)
  assert.match(source, /aria-label="Aura stage regions"/)
  assert.match(source, /label: "Fitted stage"/)
})

test("lifecycle chart marks stage changes and the latest week with four distinct symbols", () => {
  const source = readFileSync("components/aura/lifecycle-charts.tsx", "utf8")
  for (const symbol of ["triangle-up", "diamond", "triangle-down", "square"]) {
    assert.ok(source.includes(`symbol: "${symbol}"`), `${symbol} identifies one stage`)
  }
  assert.match(source, /stages\[i\] !== stages\[i - 1\]/)
  assert.match(source, /i === rows\.length - 1/)
  assert.match(source, /<Line dataKey="marker"/)
  assert.doesNotMatch(source, /<Scatter/, "Scatter forces a numeric x-axis and collapses the weekly category axis")
  assert.match(source, /aria-label="Aura stage regions"[\s\S]*?symbol/)
})
