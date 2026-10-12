import { assessSafety, type CrisisKind, type SafetyCategory } from "@/lib/safety/classify"
import { moderate, type ModerationResult } from "@/lib/_stubs/moderation"
import { decideSafetyVerdict } from "@/lib/safety/policy"

export type SafetyAction = "safe" | "refuse" | "safeguarding"

export interface SafetyVerdict {
  action: SafetyAction
  categories: SafetyCategory[]
  crisis: CrisisKind | null
  /** Which layer decided: deterministic rules, moderation endpoint, or fail-closed fallback. */
  decidedBy: "rules" | "moderation" | "fail_closed"
  /** Short machine-readable reason, for logs and the eval report. Never the input text. */
  reason: string
}

export type SafetySurface = "search" | "suggestion"

export function createInputSafetyGate(moderator: (text: string) => Promise<ModerationResult>) {
  return async (text: string, _surface: SafetySurface = "search"): Promise<SafetyVerdict> => {
    const assessment = assessSafety(text)
    if (assessment.crisis) {
      return {
        action: "safeguarding",
        categories: assessment.categories,
        crisis: assessment.crisis,
        decidedBy: "rules",
        reason: `crisis:${assessment.crisis}`,
      }
    }

    let result: ModerationResult
    try {
      result = await moderator(text)
    } catch {
      return {
        action: "refuse",
        categories: assessment.categories,
        crisis: null,
        decidedBy: "fail_closed",
        reason: "moderation_unavailable",
      }
    }
    return decideSafetyVerdict(assessment, result)
  }
}

const inputSafetyGate = createInputSafetyGate(moderate)

export async function checkInputSafety(text: string, surface: SafetySurface = "search"): Promise<SafetyVerdict> {
  return inputSafetyGate(text, surface)
}
