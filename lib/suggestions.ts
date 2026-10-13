import { sanitizeUserText } from "@/lib/discovery/prompt"
import { safetyResponseMessage } from "@/lib/safety/responses"
import type { checkInputSafety, SafetyVerdict } from "@/lib/safety/gate"
import type { recordSuggestion } from "@/lib/feedback"
import type { ActionResult } from "@/lib/types"

interface SuggestionDependencies {
  checkInputSafety: typeof checkInputSafety
  recordSuggestion: typeof recordSuggestion
}

export function createSuggestTerm(dependencies: SuggestionDependencies) {
  return async (rawTerm: string, rawContext?: string): Promise<ActionResult<SafetyVerdict>> => {
    const term = sanitizeUserText(rawTerm, 100)
    if (!term || term.length < 2) return { success: false, message: "Please enter a valid term (at least 2 characters)." }
    const context = rawContext ? sanitizeUserText(rawContext, 500) : null

    const verdict = await dependencies.checkInputSafety(`${term}\n${context ?? ""}`, "suggestion")
    if (verdict.action !== "safe") {
      return { success: false, message: safetyResponseMessage(verdict, "suggestion"), data: verdict }
    }
    try {
      const { merged } = await dependencies.recordSuggestion(term, context)
      return { success: true, message: merged ? `Thanks! We've recorded your suggestion for "${term}".` : `Thanks! We'll review "${term}".` }
    } catch (error) {
      console.error("suggestTerm failed:", error instanceof Error ? error.message : error)
      return { success: false, message: "Could not save your suggestion. Please try again." }
    }
  }
}
