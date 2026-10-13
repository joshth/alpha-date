import { test } from "node:test"
import assert from "node:assert/strict"
import type { ModerationResult } from "@/lib/_stubs/moderation"
import type { SafetyAssessment } from "@/lib/safety/classify"
import { decideSafetyVerdict } from "@/lib/safety/policy"

const clear: SafetyAssessment = { categories: [], crisis: null }
const sensitive: SafetyAssessment = { categories: ["suicide_self_harm"], crisis: null }

function result(status: ModerationResult["status"], categories: string[] = []): ModerationResult {
  return { status, categories, provider: "test", latencyMs: 0 }
}

test("clear input proceeds after a safe moderation result", () => {
  assert.deepEqual(decideSafetyVerdict(clear, result("safe")), {
    action: "safe", categories: [], crisis: null, decidedBy: "moderation", reason: "no_signal",
  })
})

test("safe moderation preserves sensitive lookup categories", () => {
  const verdict = decideSafetyVerdict(sensitive, result("safe"))
  assert.equal(verdict.action, "safe")
  assert.deepEqual(verdict.categories, ["suicide_self_harm"])
  assert.equal(verdict.reason, "sensitive_lookup")
})

for (const crisis of ["self_harm", "harm_to_others"] as const) {
  for (const status of ["safe", "flagged", "unavailable"] as const) {
    test(`local ${crisis} takes priority over ${status} moderation`, () => {
      const assessment = { categories: sensitive.categories, crisis }
      const verdict = decideSafetyVerdict(assessment, result(status, ["hate"]))
      assert.equal(verdict.action, "safeguarding")
      assert.equal(verdict.crisis, crisis)
      assert.equal(verdict.decidedBy, "rules")
      assert.equal(verdict.reason, `crisis:${crisis}`)
      assert.deepEqual(verdict.categories, assessment.categories)
    })
  }
}

test("unavailable moderation refuses without removing local categories", () => {
  assert.deepEqual(decideSafetyVerdict(sensitive, result("unavailable")), {
    action: "refuse", categories: ["suicide_self_harm"], crisis: null,
    decidedBy: "fail_closed", reason: "moderation_unavailable",
  })
})

test("provider self-harm intent triggers a self-harm safeguarding verdict", () => {
  const verdict = decideSafetyVerdict(clear, result("flagged", ["self-harm/intent"]))
  assert.equal(verdict.action, "safeguarding")
  assert.equal(verdict.crisis, "self_harm")
  assert.deepEqual(verdict.categories, ["suicide_self_harm"])
  assert.equal(verdict.decidedBy, "moderation")
})

for (const category of ["self-harm/instructions", "sexual/minors", "hate/threatening", "harassment/threatening"]) {
  test(`${category} safeguards without inventing a crisis type`, () => {
    const verdict = decideSafetyVerdict(clear, result("flagged", [category]))
    assert.equal(verdict.action, "safeguarding")
    assert.equal(verdict.crisis, null)
    assert.equal(verdict.reason, "moderation_safeguarding")
    assert.equal(verdict.categories.length, 1)
  })
}

for (const category of ["violence", "violence/graphic", "illicit/violent", "hate", "harassment", "self-harm", "sexual", "illicit", "personal-information"]) {
  test(`${category} refuses without inferring first-person intent`, () => {
    const verdict = decideSafetyVerdict(clear, result("flagged", [category]))
    assert.equal(verdict.action, "refuse")
    assert.equal(verdict.crisis, null)
    assert.equal(verdict.reason, "moderation_flagged")
  })
}

test("unrecognised and empty flagged results still refuse", () => {
  for (const categories of [[], ["new-provider-category"], ["constructor"]]) {
    const verdict = decideSafetyVerdict(clear, result("flagged", categories))
    assert.equal(verdict.action, "refuse")
    assert.deepEqual(verdict.categories, [])
  }
})

test("safeguarding wins over refusal regardless of category order", () => {
  for (const categories of [["hate", "sexual/minors"], ["sexual/minors", "hate"]]) {
    assert.equal(decideSafetyVerdict(clear, result("flagged", categories)).action, "safeguarding")
  }
})

test("mapped categories merge with local categories without duplicates or mutation", () => {
  const assessment: SafetyAssessment = { categories: ["suicide_self_harm"], crisis: null }
  const moderation = result("flagged", ["self-harm/intent", "self-harm", "violence", "violence"])
  const verdict = decideSafetyVerdict(assessment, moderation)
  assert.deepEqual(verdict.categories, ["suicide_self_harm", "violence_threat"])
  assert.deepEqual(assessment.categories, ["suicide_self_harm"])
  assert.deepEqual(moderation.categories, ["self-harm/intent", "self-harm", "violence", "violence"])
})

test("a safe status cannot override nonempty provider flags", () => {
  assert.equal(decideSafetyVerdict(clear, result("safe", ["violence"])).action, "refuse")
  assert.equal(decideSafetyVerdict(clear, result("safe", ["self-harm/intent"])).action, "safeguarding")
})
