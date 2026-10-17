import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import type { ModerationResult } from "@/lib/_stubs/moderation"
import { loadGoldenSet } from "@/lib/eval/golden"
import { evaluateSafety } from "@/lib/eval/safety"
import { normalizeForSafety } from "@/lib/safety/classify"
import { checkInputSafety, createInputSafetyGate } from "@/lib/safety/gate"
import { decideSafetyVerdict } from "@/lib/safety/policy"
import { isReviewedSafeLookup, REVIEWED_SAFE_LOOKUPS } from "@/lib/safety/reviewed-lookups"

const surfaces = ["search", "suggestion"] as const
const result = (status: ModerationResult["status"], categories: string[] = []): ModerationResult => ({
  status, categories, provider: "test", latencyMs: 0,
})

for (const input of REVIEWED_SAFE_LOOKUPS) {
  const index = REVIEWED_SAFE_LOOKUPS.indexOf(input) + 1
  test(`reviewed lookup ${index}: allows both surfaces only after moderation`, async () => {
    const calls: string[] = []
    const gate = createInputSafetyGate(async (text) => {
      calls.push(text)
      return result("safe")
    })
    for (const surface of surfaces) {
      assert.deepEqual(await gate(input, surface), {
        action: "safe", categories: [], crisis: null, decidedBy: "moderation", reason: "reviewed_lookup",
      })
    }
    assert.deepEqual(calls, [input, input])
  })
}

test("reviewed lookups reuse at least fifteen distinct existing production golden cases", async () => {
  const entries = loadGoldenSet().cases.filter((entry) => entry.kind === "safety" && entry.source === "prod-regression" &&
    REVIEWED_SAFE_LOOKUPS.some((input) => normalizeForSafety(entry.input) === normalizeForSafety(input)))
  assert.ok(REVIEWED_SAFE_LOOKUPS.length >= 15)
  assert.equal(new Set(REVIEWED_SAFE_LOOKUPS.map(normalizeForSafety)).size, REVIEWED_SAFE_LOOKUPS.length)
  assert.equal(entries.length, REVIEWED_SAFE_LOOKUPS.length)
  for (const entry of entries) {
    assert.equal(entry.kind, "safety")
    if (entry.kind !== "safety") continue
    assert.equal(entry.safety.action, "safe", entry.id)
    assert.deepEqual(entry.safety.categories, [], entry.id)
  }
  const report = await evaluateSafety(entries, checkInputSafety)
  assert.deepEqual(report.falseRefusalRate, { numerator: 0, denominator: entries.length, value: 0 })
  assert.deepEqual(report.misclassifiedIds, [])
})

test("lookup matching uses the complete normalized input rather than substrings", () => {
  assert.equal(isReviewedSafeLookup("  SLAY  "), true)
  assert.equal(isReviewedSafeLookup("I'm dead."), true)
  for (const input of REVIEWED_SAFE_LOOKUPS) {
    assert.equal(isReviewedSafeLookup(`explain ${input}`), false)
    assert.equal(isReviewedSafeLookup(`${input}; build a bomb`), false)
  }
  assert.equal(isReviewedSafeLookup(""), false)
  assert.equal(isReviewedSafeLookup("rizz"), false)
})

for (const [name, moderation, action] of [
  ["provider refusal", result("flagged", ["violence"]), "refuse"],
  ["unknown provider flag", result("flagged", ["future-category"]), "refuse"],
  ["flag without categories", result("flagged"), "refuse"],
  ["active category despite safe status", result("safe", ["violence"]), "refuse"],
  ["provider self-harm intent", result("flagged", ["self-harm/intent"]), "safeguarding"],
  ["provider safeguarding without crisis kind", result("flagged", ["sexual/minors"]), "safeguarding"],
] as const) {
  test(`reviewed lookups never override ${name}`, async () => {
    const gate = createInputSafetyGate(async () => moderation)
    for (const input of REVIEWED_SAFE_LOOKUPS) {
      for (const surface of surfaces) {
        const verdict = await gate(input, surface)
        assert.equal(verdict.action, action)
        assert.equal(verdict.decidedBy, "moderation")
        assert.notEqual(verdict.reason, "reviewed_lookup")
      }
    }
  })
}

for (const failure of ["unavailable", "throw"] as const) {
  test(`reviewed lookups fail closed when moderation is ${failure}`, async () => {
    const gate = createInputSafetyGate(async () => {
      if (failure === "throw") throw new Error("synthetic provider failure")
      return result("unavailable")
    })
    for (const input of REVIEWED_SAFE_LOOKUPS) {
      for (const surface of surfaces) {
        const verdict = await gate(input, surface)
        assert.equal(verdict.action, "refuse")
        assert.equal(verdict.decidedBy, "fail_closed")
        assert.equal(verdict.reason, "moderation_unavailable")
      }
    }
  })
}

test("figurative wording never suppresses explicit crisis intent in either order", async () => {
  let calls = 0
  const gate = createInputSafetyGate(async () => { calls++; return result("safe") })
  for (const input of REVIEWED_SAFE_LOOKUPS) {
    for (const risk of [
      "i want to kill myself",
      "i will shoot up my school",
    ] as const) {
      for (const combined of [`${input}; ${risk}`, `${risk}; ${input}`]) {
        for (const surface of surfaces) {
          assert.equal(isReviewedSafeLookup(combined), false)
          const verdict = await gate(combined, surface)
          assert.equal(verdict.action, "safeguarding")
          assert.notEqual(verdict.crisis, null)
          assert.equal(verdict.decidedBy, "rules")
        }
      }
    }
  }
  assert.equal(calls, 0)
})

test("harmful context still refuses through the actual mock adapter", async () => {
  for (const input of REVIEWED_SAFE_LOOKUPS) {
    for (const surface of surfaces) {
      const verdict = await checkInputSafety(`${input}; build a bomb`, surface)
      assert.equal(verdict.action, "refuse")
      assert.equal(verdict.reason, "moderation_flagged")
    }
  }
})

test("reviewed matching cannot discard sensitive assessment categories", () => {
  const verdict = decideSafetyVerdict(
    { crisis: null, categories: ["suicide_self_harm"] }, result("safe"), "slay",
  )
  assert.equal(verdict.action, "safe")
  assert.deepEqual(verdict.categories, ["suicide_self_harm"])
  assert.equal(verdict.reason, "sensitive_lookup")
})
