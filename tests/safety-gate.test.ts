import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkInputSafety, type SafetySurface, type SafetyVerdict } from "@/lib/safety/gate"

const cases: { name: string; input: string; expected: SafetyVerdict }[] = [
  {
    name: "ordinary slang",
    input: "rizz",
    expected: {
      action: "safe",
      categories: [],
      crisis: null,
      decidedBy: "rules",
      reason: "no_signal",
    },
  },
  {
    name: "sensitive educational lookup",
    input: "kms",
    expected: {
      action: "safe",
      categories: ["suicide_self_harm"],
      crisis: null,
      decidedBy: "rules",
      reason: "sensitive_lookup",
    },
  },
  {
    name: "self-harm intent",
    input: "i want to kill myself",
    expected: {
      action: "safeguarding",
      categories: ["suicide_self_harm"],
      crisis: "self_harm",
      decidedBy: "rules",
      reason: "crisis:self_harm",
    },
  },
  {
    name: "intent to harm others",
    input: "i will shoot up my school",
    expected: {
      action: "safeguarding",
      categories: ["violence_threat"],
      crisis: "harm_to_others",
      decidedBy: "rules",
      reason: "crisis:harm_to_others",
    },
  },
]

for (const surface of ["search", "suggestion"] satisfies SafetySurface[]) {
  for (const { name, input, expected } of cases) {
    test(`rules baseline: ${surface} returns the complete verdict for ${name}`, async () => {
      assert.deepEqual(await checkInputSafety(input, surface), expected)
    })
  }
}

test("omitting the surface uses search behaviour", async () => {
  for (const { input } of cases) {
    assert.deepEqual(await checkInputSafety(input), await checkInputSafety(input, "search"))
  }
})

test("crisis intent takes priority when ordinary slang is also present", async () => {
  const verdict = await checkInputSafety("rizz, i want to kill myself")

  assert.equal(verdict.action, "safeguarding")
  assert.equal(verdict.crisis, "self_harm")
  assert.equal(verdict.reason, "crisis:self_harm")
})

test("verdict reasons contain no input text", async () => {
  const input = "private-fixture-928 i want to kill myself"
  const verdict = await checkInputSafety(input)

  assert.equal(verdict.reason, "crisis:self_harm")
  assert.ok(!JSON.stringify(verdict).includes("private-fixture-928"))
})
