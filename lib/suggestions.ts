import { MAX_INJECTION_INPUT_LENGTH } from "@/lib/safety/injection"
import { redactPersonalInformation, redactPersonalInformationWithResult } from "@/lib/safety/privacy"
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
    if (typeof rawTerm !== "string" || rawTerm.length > MAX_INJECTION_INPUT_LENGTH || (typeof rawContext === "string" && rawContext.length > MAX_INJECTION_INPUT_LENGTH)) return {success: false, message: "Please enter a shorter term or context."}
    const validatedTerm = sanitizeUserText(rawTerm, 100)
    const input = validatedTerm ? redactPersonalInformationWithResult(validatedTerm) : null
    const term = input?.text
    if (!term || term.length < 2) return { success: false, message: "Please enter a term between 2 and 100 characters." }
    let privacyRedacted = Boolean(input?.redacted)
    const respond = (result: ActionResult<SafetyVerdict>): ActionResult<SafetyVerdict> => privacyRedacted ? { ...result, privacyRedacted: true } : result
    if (rawContext !== undefined && typeof rawContext !== "string") {
      return respond({ success: false, message: "Please enter valid text for the context." })
    }
    const validatedContext = rawContext ? sanitizeUserText(rawContext, 500) : null
    const contextInput = validatedContext ? redactPersonalInformationWithResult(validatedContext) : null
    const context = contextInput?.text ?? null
    privacyRedacted ||= Boolean(contextInput?.redacted)
    if (rawContext?.trim() && !context) {
      return respond({ success: false, message: "Please keep context to 500 characters or fewer." })
    }

    const submission = rawContext === undefined ? rawTerm : `${rawTerm}\n${rawContext}`
    if (submission.length > MAX_INJECTION_INPUT_LENGTH) return respond({success: false, message: "Please enter a shorter term or context."})
    const original = redactPersonalInformationWithResult(submission.length <= 10000 ? submission : prepareSafetyInput(submission))
    privacyRedacted ||= original.redacted
    const verdict = await dependencies.checkInputSafety(
      `${redactPersonalInformation(prepareSafetyInput(rawTerm))}\n${redactPersonalInformation(prepareSafetyInput(rawContext ?? ""))}`, "suggestion", original.text,
    )
    if (verdict.action !== "safe") {
      return respond({ success: false, message: safetyResponseMessage(verdict, "suggestion"), data: verdict })
    }
    try {
      const { merged } = await dependencies.recordSuggestion(term, context)
      return respond({ success: true, message: merged ? `Thanks! We've recorded your suggestion for "${term}".` : `Thanks! We'll review "${term}".` })
    } catch {
      console.error("suggestTerm failed.")
      return respond({ success: false, message: "Could not save your suggestion. Please try again." })
    }
  }
}
