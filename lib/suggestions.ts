import { redactPersonalInformation } from "@/lib/safety/privacy"
import { prepareSafetyInput } from "@/lib/safety/input"
import { sanitizeUserText } from "@/lib/discovery/prompt"
import { safetyResponseMessage } from "@/lib/safety/responses"
import type { RequestSafetyCheck, SafetyVerdict } from "@/lib/safety/gate"
import type { recordSuggestion } from "@/lib/feedback"
import type { ActionResult } from "@/lib/types"

interface SuggestionDependencies {
  checkInputSafety: RequestSafetyCheck
  recordSuggestion: typeof recordSuggestion
}

export function createSuggestTerm(dependencies: SuggestionDependencies) {
  return async (rawTerm: string, rawContext?: string): Promise<ActionResult<SafetyVerdict>> => {
    const validatedTerm = sanitizeUserText(rawTerm, 100)
    const term = validatedTerm ? redactPersonalInformation(validatedTerm) : null
    if (!term || term.length < 2) return { success: false, message: "Please enter a term between 2 and 100 characters." }
    if (rawContext !== undefined && typeof rawContext !== "string") {
      return { success: false, message: "Please enter valid text for the context." }
    }
    const validatedContext = rawContext ? sanitizeUserText(rawContext, 500) : null
    const context = validatedContext ? redactPersonalInformation(validatedContext) : null
    if (rawContext?.trim() && !context) {
      return { success: false, message: "Please keep context to 500 characters or fewer." }
    }

    const submission = rawContext === undefined ? rawTerm : `${rawTerm}\n${rawContext}`
    const original = redactPersonalInformation(submission.length <= 10000 ? submission : prepareSafetyInput(submission))
    const verdict = await dependencies.checkInputSafety(
      `${redactPersonalInformation(prepareSafetyInput(rawTerm))}\n${redactPersonalInformation(prepareSafetyInput(rawContext ?? ""))}`, "suggestion", original,
    )
    if (verdict.action !== "safe") {
      return { success: false, message: safetyResponseMessage(verdict, "suggestion"), data: verdict }
    }
    try {
      const { merged } = await dependencies.recordSuggestion(term, context)
      return { success: true, message: merged ? `Thanks! We've recorded your suggestion for "${term}".` : `Thanks! We'll review "${term}".` }
    } catch {
      console.error("suggestTerm failed.")
      return { success: false, message: "Could not save your suggestion. Please try again." }
    }
  }
}
