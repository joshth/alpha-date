import type { ModerationResult } from "@/lib/_stubs/moderation"
import type { SafetyAssessment, SafetyCategory } from "@/lib/safety/classify"
import type { SafetyVerdict } from "@/lib/safety/gate"

const CATEGORY_MAP: Partial<Record<string, SafetyCategory>> = {
  "self-harm": "suicide_self_harm",
  "self-harm/intent": "suicide_self_harm",
  "self-harm/instructions": "suicide_self_harm",
  "sexual/minors": "sexual_exploitation",
  violence: "violence_threat",
  "violence/graphic": "violence_threat",
  "illicit/violent": "violence_threat",
  hate: "bullying_harassment",
  "hate/threatening": "bullying_harassment",
  harassment: "bullying_harassment",
  "harassment/threatening": "bullying_harassment",
}

const SAFEGUARDING_CATEGORIES = new Set([
  "self-harm/intent",
  "self-harm/instructions",
  "sexual/minors",
  "hate/threatening",
  "harassment/threatening",
])

export function decideSafetyVerdict(assessment: SafetyAssessment, moderation: ModerationResult): SafetyVerdict {
  if (assessment.crisis) {
    return {
      action: "safeguarding",
      categories: [...new Set(assessment.categories)],
      crisis: assessment.crisis,
      decidedBy: "rules",
      reason: `crisis:${assessment.crisis}`,
    }
  }

  const categories = new Set(assessment.categories)
  for (const category of moderation.categories) {
    const mapped = Object.hasOwn(CATEGORY_MAP, category) ? CATEGORY_MAP[category] : undefined
    if (mapped) categories.add(mapped)
  }
  const base = { categories: [...categories], crisis: null }

  if (moderation.status === "unavailable") {
    return { ...base, action: "refuse", decidedBy: "fail_closed", reason: "moderation_unavailable" }
  }

  if (moderation.status === "safe" && moderation.categories.length === 0) {
    return {
      ...base,
      action: "safe",
      decidedBy: "moderation",
      reason: categories.size ? "sensitive_lookup" : "no_signal",
    }
  }

  if (moderation.categories.some((category) => SAFEGUARDING_CATEGORIES.has(category))) {
    return {
      ...base,
      action: "safeguarding",
      crisis: moderation.categories.includes("self-harm/intent") ? "self_harm" : null,
      decidedBy: "moderation",
      reason: "moderation_safeguarding",
    }
  }

  return { ...base, action: "refuse", decidedBy: "moderation", reason: "moderation_flagged" }
}
