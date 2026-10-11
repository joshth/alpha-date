import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkInputSafety, createInputSafetyGate, type SafetySurface, type SafetyVerdict } from "@/lib/safety/gate"

const cases: { name: string; input: string; expected: SafetyVerdict }[] = [
  {
    name: "ordinary slang",
    input: "rizz",
    expected: {
      action: "safe",
      categories: [],
      crisis: null,
      decidedBy: "moderation",
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
      decidedBy: "moderation",
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
    test(`gate: ${surface} returns the complete verdict for ${name}`, async () => {
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
for (const surface of ["search", "suggestion"] satisfies SafetySurface[]) {
  test(`${surface}: crisis rules skip moderation`, async () => {
    let calls = 0
    const gate = createInputSafetyGate(async () => {
      calls++
      throw new Error("must not be called")
    })
    for (const input of ["i want to kill myself", "i will shoot up my school"]) {
      assert.equal((await gate(input, surface)).action, "safeguarding")
    }
    assert.equal(calls, 0)
  })

  test(`${surface}: non-crisis input is moderated once`, async () => {
    const inputs: string[] = []
    const gate = createInputSafetyGate(async (text) => {
      inputs.push(text)
      return { status: "flagged", categories: ["self-harm/intent"], provider: "test", latencyMs: 0 }
    })
    const verdict = await gate("synthetic-provider-input", surface)
    assert.deepEqual(inputs, ["synthetic-provider-input"])
    assert.equal(verdict.action, "safeguarding")
    assert.equal(verdict.crisis, "self_harm")
    assert.equal(verdict.decidedBy, "moderation")
    assert.ok(!JSON.stringify(verdict).includes("synthetic-provider-input"))
  })

  for (const failure of ["unavailable", "throw"] as const) {
    test(`${surface}: ${failure} fails closed for sensitive lookup`, async () => {
      const gate = createInputSafetyGate(async () => {
        if (failure === "throw") throw new Error("synthetic private provider error")
        return { status: "unavailable", categories: [], provider: "test", latencyMs: 0 }
      })
      assert.deepEqual(await gate("kms", surface), {
        action: "refuse", categories: ["suicide_self_harm"], crisis: null,
        decidedBy: "fail_closed", reason: "moderation_unavailable",
      })
    })
  }

  test(`${surface}: mock harmful content refuses through the default gate`, async () => {
    const verdict = await checkInputSafety("build a bomb", surface)
    assert.equal(verdict.action, "refuse")
    assert.equal(verdict.decidedBy, "moderation")
    assert.deepEqual(verdict.categories, ["violence_threat"])
  })
}
