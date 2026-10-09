import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkInputSafety } from "@/lib/safety/gate"
import { resourcesFor } from "@/lib/safety/resources"
import { loadGoldenSet } from "@/lib/eval/golden"

// Production's regression baseline, run through the gate. Your gate changes
// must keep every prod-regression case passing (and crisis recall at 100%).

const golden = loadGoldenSet()
const prodSafety = golden.cases.filter((c) => c.kind === "safety" && c.source === "prod-regression")

test("golden set validates and contains production's safety regression cases", () => {
  assert.ok(prodSafety.length >= 50)
})

for (const c of prodSafety) {
  if (c.kind !== "safety") continue
  test(`gate: ${c.id}`, async () => {
    const verdict = await checkInputSafety(c.input)
    assert.equal(verdict.action, c.safety.action, `action for case ${c.id}`)
    assert.equal(verdict.crisis ?? undefined, c.safety.crisis, `crisis for case ${c.id}`)
    for (const category of c.safety.categories) {
      assert.ok(verdict.categories.includes(category), `category ${category} for case ${c.id}`)
    }
    if (c.safety.categories.length === 0) assert.deepEqual(verdict.categories, [], `no categories for case ${c.id}`)
  })
}

test("every sensitive category maps to at least two help resources", () => {
  for (const category of ["suicide_self_harm", "eating_disorder", "sexual_exploitation", "violence_threat", "bullying_harassment"] as const) {
    assert.ok(resourcesFor([category]).length >= 2, category)
  }
})
