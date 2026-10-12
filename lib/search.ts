import { generateDiscoveryObject } from "@/lib/_stubs/llm"
import { discoverTerm, type GenerateDiscovery } from "@/lib/discovery/discover"
import { MAX_INPUT_LENGTH, sanitizeUserText } from "@/lib/discovery/prompt"
import { normaliseSuggestion } from "@/lib/normalise"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, logTermEvent, saveDiscoveredTerm } from "@/lib/terms-store"
import type { SearchOutcome } from "@/lib/types"

// Pipeline: input → safety gate → lexicon lookup → AI discovery → stored for
// review. Mirrors the order production uses; the gate always runs first.

export async function runSearch(raw: string, generate: GenerateDiscovery = generateDiscoveryObject): Promise<SearchOutcome> {
  const query = sanitizeUserText(raw, MAX_INPUT_LENGTH)
  if (!query) return { kind: "error", message: `Please enter a term (up to ${MAX_INPUT_LENGTH} characters).` }

  const verdict = await checkInputSafety(query, "search")
  if (verdict.action === "safeguarding") return { kind: "safeguarding", verdict }
  if (verdict.action === "refuse") {
    return { kind: "refused", verdict, message: "We can't look that up. If something online has upset you, the services below can help." }
  }

  try {
    const existing = await getTermByKey(normaliseSuggestion(query))
    if (existing) await logTermEvent(query, "ai_call_avoided")
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
    const discovered = await discoverTerm(query, generate)
    if (!discovered) return { kind: "not_found", verdict, query }

    const saved = await saveDiscoveredTerm(discovered.term)
    await logTermEvent(query, "llm_generated")
    // saveDiscoveredTerm returns null if another request just saved the same
    // term first; fall back to the term we discovered so the caller still
    // gets a result.
    const persistedTerm = saved ? saved.term : discovered.term
    return {
      kind: "discovered",
      term: persistedTerm,
      verdict,
      note: "AI-generated and unverified. Saved for human review before anyone else sees it.",
    }
  } catch (error) {
    console.error("runSearch failed:", error instanceof Error ? error.message : error)
    return { kind: "error", message: "Something went wrong looking that up. Please try again." }
  }
}
