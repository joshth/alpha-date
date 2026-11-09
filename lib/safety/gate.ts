import { assessSafety, type CrisisKind, type SafetyCategory } from "@/lib/safety/classify"
import { moderate, type ModerationResult } from "@/lib/_stubs/moderation"
import { decideSafetyVerdict } from "@/lib/safety/policy"
import { assessContextualSafety } from "@/lib/safety/context"

export type SafetyAction = "safe" | "gentle_support" | "refuse" | "safeguarding"

export interface SafetyVerdict {
  action: SafetyAction
  categories: SafetyCategory[]
  crisis: CrisisKind | null
  /** Which layer decided: deterministic rules, moderation endpoint, or fail-closed fallback. */
  decidedBy: "rules" | "moderation" | "fail_closed"
  /** Short machine-readable reason, for logs and the eval report. Never the input text. */
  reason: string
  incidentReference?: string
}

export type SafetySurface = "search" | "suggestion"
export type RequestSafetyCheck = (text: string, surface: SafetySurface, originalText: string) => Promise<SafetyVerdict>

export function createInputSafetyGate(moderator: (text: string) => Promise<ModerationResult>) {
  return async (text: string, surface: SafetySurface = "search"): Promise<SafetyVerdict> => {
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

    const contextual = assessContextualSafety(text)
    if (contextual && contextual.action !== "gentle_support") {
      return { ...contextual, categories: [...new Set([...assessment.categories, ...contextual.categories])] }
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
    const verdict = decideSafetyVerdict(assessment, result, text)
    // Provider flags and outages take priority over a gentle response.
    if (verdict.action !== "safe") return verdict
    if (contextual) return { ...contextual, categories: verdict.categories }
    if (surface === "suggestion" && verdict.categories.length > 0) {
      return { ...verdict, action: "refuse", decidedBy: "rules", reason: "sensitive_suggestion" }
    }
    return verdict
  }
}

const inputSafetyGate = createInputSafetyGate(moderate)

export async function checkInputSafety(text: string, surface: SafetySurface = "search"): Promise<SafetyVerdict> {
  return inputSafetyGate(text, surface)
}
