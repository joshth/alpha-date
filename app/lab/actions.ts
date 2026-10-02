"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, isReviewer } from "@/lib/_stubs/auth"
import { generateDiscoveryObject } from "@/lib/_stubs/llm"
import { discoverTerm } from "@/lib/discovery/discover"
import { MAX_INPUT_LENGTH, sanitizeUserText } from "@/lib/discovery/prompt"
import { recordSuggestion } from "@/lib/feedback"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermRecord, logTermEvent, saveDiscoveredTerm, setTermStatus } from "@/lib/terms-store"
import type { ActionResult, SearchOutcome } from "@/lib/types"

// Pipeline: input → safety gate → lexicon lookup → AI discovery → stored for
// review. Mirrors the order production uses; the gate always runs first.

export async function searchTerm(raw: string): Promise<SearchOutcome> {
  const query = sanitizeUserText(raw, MAX_INPUT_LENGTH)
  if (!query) return { kind: "error", message: `Please enter a term (up to ${MAX_INPUT_LENGTH} characters).` }

  const verdict = await checkInputSafety(query, "search")
  if (verdict.action === "safeguarding") return { kind: "safeguarding", verdict }
  if (verdict.action === "refuse") {
    return { kind: "refused", verdict, message: "We can't look that up. If something online has upset you, the services below can help." }
  }

  try {
    const existing = await getTermRecord(query)
    if (existing && existing.status === "published") {
      await logTermEvent(query, "search_hit")
      return { kind: "found", term: existing.term, verdict }
    }
    if (existing && existing.status === "pending_review") {
      return { kind: "discovered", term: existing.term, verdict, note: "This term is waiting for human review." }
    }
    if (existing && existing.status === "rejected") {
      await logTermEvent(query, "search_miss")
      return { kind: "not_found", verdict, query }
    }

    await logTermEvent(query, "search_miss")
    const discovered = await discoverTerm(query, generateDiscoveryObject)
    if (!discovered) return { kind: "not_found", verdict, query }
    const saved = await saveDiscoveredTerm(discovered.term)
    await logTermEvent(query, "llm_generated")
    return {
      kind: "discovered",
      term: saved?.term ?? discovered.term,
      verdict,
      note: "AI-generated and unverified. Saved for human review before anyone else sees it.",
    }
  } catch (error) {
    console.error("searchTerm failed:", error instanceof Error ? error.message : error)
    return { kind: "error", message: "Something went wrong looking that up. Please try again." }
  }
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
