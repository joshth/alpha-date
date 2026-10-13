"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, isReviewer } from "@/lib/_stubs/auth"
import { generateDiscoveryObject } from "@/lib/_stubs/llm"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"
import { recordSuggestion } from "@/lib/feedback"
import { checkInputSafety, type SafetyVerdict } from "@/lib/safety/gate"
import { getAiCallsAvoided, getTermByKey, logTermEvent, saveDiscoveredTerm, setTermStatus } from "@/lib/terms-store"
import type { ActionResult, SearchOutcome } from "@/lib/types"

const runSearch = createSearchTerm({ checkInputSafety, getTermByKey, logTermEvent, generateDiscoveryObject, saveDiscoveredTerm })

export async function searchTerm(raw: string): Promise<SearchOutcome> {
  return runSearch(raw)
}

export async function fetchAiCallsAvoided(): Promise<number> {
  return getAiCallsAvoided()
}

const runSuggestion = createSuggestTerm({ checkInputSafety, recordSuggestion })

export async function suggestTerm(rawTerm: string, rawContext?: string): Promise<ActionResult<SafetyVerdict>> {
  return runSuggestion(rawTerm, rawContext)
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
