import { test } from "node:test"
import assert from "node:assert/strict"
import { fittedStages } from "../lib/aura/stage-regions"

test("rolling fitted stages identify rising, peaking, declining and stable curves", () => {
  const rising = Array.from({ length: 40 }, (_, i) => i + 1)
  const peak = Array.from({ length: 40 }, (_, i) => i < 20 ? i + 1 : 40 - i)
  const decline = Array.from({ length: 40 }, (_, i) => 40 - i)
  const stable = Array.from({ length: 40 }, () => 10)
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
