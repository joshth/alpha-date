"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, isReviewer } from "@/lib/_stubs/auth"
import { generateDiscoveryObject } from "@/lib/_stubs/llm"
import { moderate } from "@/lib/_stubs/moderation"
import { createSafeDiscovery } from "@/lib/discovery/safe-discovery"
import { createSafeTermLookup } from "@/lib/safety/safe-term-lookup"
import { createTrackedSafetyGate } from "@/lib/safety/events"
import { recordSafetyEvent } from "@/lib/safety/event-store"
import { readSafetyActivity, type SafetyActivity } from "@/lib/safety/activity"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"
import { recordSuggestion } from "@/lib/feedback"
import type { DedupSavings } from "@/lib/dedup/savings"
import type { DedupGraphData } from "@/lib/dedup/graph"
import { readDedupRows, readDedupSavings } from "@/lib/dedup/store"
import { loadGoldenSet } from "@/lib/eval/golden"
import { checkInputSafety, type SafetyVerdict } from "@/lib/safety/gate"
import { getAiCallsAvoided, getTermByKey, getTermEvents, listPublishedTermNames, logTermEvent, saveDiscoveredTerm, setTermStatus } from "@/lib/terms-store"
import { createAuraFit, type AuraFitResult } from "@/lib/aura/fit"
import { runFit } from "@/lib/aura/fit-command"
import { sanitizeUserText } from "@/lib/discovery/prompt"
import { prepareSafetyInput } from "@/lib/safety/input"
import { safetyResponseMessage } from "@/lib/safety/responses"
import type { ActionResult, SearchOutcome } from "@/lib/types"

// Pipeline: input → safety gate → lexicon lookup → AI discovery → stored for
// review. Mirrors the order production uses; the gate always runs first.

const trackedInputSafety = createTrackedSafetyGate(checkInputSafety, recordSafetyEvent)
const generateSafeDiscovery = createSafeDiscovery(generateDiscoveryObject, moderate)
const getSafeTermByKey = createSafeTermLookup(getTermByKey, moderate)
const runSearch = createSearchTerm({ checkInputSafety: trackedInputSafety, getTermByKey: getSafeTermByKey, logTermEvent, generateDiscoveryObject: generateSafeDiscovery, saveDiscoveredTerm })

export async function searchTerm(raw: string): Promise<SearchOutcome> {
  return runSearch(raw)
}

export async function fetchAiCallsAvoided(): Promise<number> {
  return getAiCallsAvoided()
}

const runSuggestion = createSuggestTerm({ checkInputSafety: trackedInputSafety, recordSuggestion })

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

export async function getSafetyActivity(from: string, to: string): Promise<SafetyActivity> {
  const user = await getSessionUser()
  if (!user || !isReviewer(user)) throw new Error("Reviewer access required.")
  return readSafetyActivity({ from, to })
}

// Aura dashboard: gate the term like search, then fit it (vendored SIRS data or our own events).
// One instance per server process, so its cache makes repeat lookups instant.
const runAuraFit = createAuraFit({ runFit, getTermEvents, listPublishedTermNames, now: () => new Date() })

export type AuraFitOutcome = AuraFitResult | { kind: "blocked"; message: string } | { kind: "invalid"; message: string }

export async function fitAuraTerm(raw: string): Promise<AuraFitOutcome> {
  const term = sanitizeUserText(raw, 100)
  if (!term || term.length < 2) return { kind: "invalid", message: "Enter a term between 2 and 100 characters." }
  const verdict = await trackedInputSafety(prepareSafetyInput(raw), "search")
  if (verdict.action !== "safe") return { kind: "blocked", message: safetyResponseMessage(verdict, "search") }
  return runAuraFit(term)
}

export async function getDedupSavings(minutesPerReview = 2): Promise<DedupSavings> {
  const ok = Number.isFinite(minutesPerReview) && minutesPerReview >= 0 && minutesPerReview <= 10000
  return readDedupSavings(ok ? minutesPerReview : 2)
}

export async function getDedupGraph(): Promise<DedupGraphData> {
  let golden: DedupGraphData["golden"] = []
  try {
    golden = loadGoldenSet().cases.flatMap((c) => (c.kind === "dedup" ? [{ input: c.input, candidate: c.dedup.candidate, sameTerm: c.dedup.sameTerm }] : []))
  } catch {
    // No readable golden set: the explorer then says "No golden dedup cases loaded." instead of failing.
  }
  return { rows: await readDedupRows(), lexicon: await listPublishedTermNames(), golden }
}
