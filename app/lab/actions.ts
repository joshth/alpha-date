"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, isReviewer } from "@/lib/_stubs/auth"
import { sanitizeUserText } from "@/lib/discovery/prompt"
import { recordSuggestion } from "@/lib/feedback"
import { runSearch } from "@/lib/search"
import { checkInputSafety } from "@/lib/safety/gate"
import { getAiCallsAvoided, setTermStatus } from "@/lib/terms-store"
import type { ActionResult, SearchOutcome } from "@/lib/types"

export async function searchTerm(raw: string): Promise<SearchOutcome> {
  return runSearch(raw)
}

export async function fetchAiCallsAvoided(): Promise<number> {
  return getAiCallsAvoided()
}

export async function suggestTerm(rawTerm: string, rawContext?: string): Promise<ActionResult> {
  const term = sanitizeUserText(rawTerm, 100)
  if (!term || term.length < 2) return { success: false, message: "Please enter a valid term (at least 2 characters)." }
  const context = rawContext ? sanitizeUserText(rawContext, 500) : null

  const verdict = await checkInputSafety(`${term}\n${context ?? ""}`, "suggestion")
  if (verdict.action !== "safe") {
    return { success: false, message: "We can't add that suggestion. If something online has upset you, Kids Helpline (1800 55 1800) can help." }
  }
  try {
    const { merged } = await recordSuggestion(term, context)
    return { success: true, message: merged ? `Thanks! We've recorded your suggestion for "${term}".` : `Thanks! We'll review "${term}".` }
  } catch (error) {
    console.error("suggestTerm failed:", error instanceof Error ? error.message : error)
    return { success: false, message: "Could not save your suggestion. Please try again." }
  }
}

export async function reviewTerm(id: string, decision: "published" | "rejected"): Promise<ActionResult> {
  const user = await getSessionUser()
  if (!user || !isReviewer(user)) return { success: false, message: "Reviewer access required." }
  if (typeof id !== "string" || !id || (decision !== "published" && decision !== "rejected")) {
    return { success: false, message: "Invalid review request." }
  }
  try {
    const changed = await setTermStatus(id, decision)
    if (!changed) return { success: false, message: "That term is no longer awaiting review." }
    revalidatePath("/lab/review")
    return { success: true, message: decision === "published" ? "Term published." : "Term rejected." }
  } catch (error) {
    console.error("reviewTerm failed:", error instanceof Error ? error.message : error)
    return { success: false, message: "Could not save the review decision." }
  }
}
