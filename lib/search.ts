import { discoverTerm } from "@/lib/discovery/discover"
import { MAX_INPUT_LENGTH, sanitizeUserText } from "@/lib/discovery/prompt"
import { safetyResponseMessage } from "@/lib/safety/responses"
import type { checkInputSafety } from "@/lib/safety/gate"
import type { generateDiscoveryObject } from "@/lib/_stubs/llm"
import type { getTermRecord, logTermEvent, saveDiscoveredTerm } from "@/lib/terms-store"
import type { SearchOutcome } from "@/lib/types"

interface SearchDependencies {
  checkInputSafety: typeof checkInputSafety
  getTermRecord: typeof getTermRecord
  logTermEvent: typeof logTermEvent
  generateDiscoveryObject: typeof generateDiscoveryObject
  saveDiscoveredTerm: typeof saveDiscoveredTerm
}

export function createSearchTerm(dependencies: SearchDependencies) {
  return async (raw: string): Promise<SearchOutcome> => {
    const query = sanitizeUserText(raw, MAX_INPUT_LENGTH)
    if (!query) return { kind: "error", message: `Please enter a term (up to ${MAX_INPUT_LENGTH} characters).` }

    const verdict = await dependencies.checkInputSafety(query, "search")
    if (verdict.action === "safeguarding") return { kind: "safeguarding", verdict }
    if (verdict.action === "refuse") {
      return { kind: "refused", verdict, message: safetyResponseMessage(verdict, "search") }
    }

    try {
      const existing = await dependencies.getTermRecord(query)
      if (existing && existing.status === "published") {
        await dependencies.logTermEvent(query, "search_hit")
        return { kind: "found", term: existing.term, verdict }
      }
      if (existing && existing.status === "pending_review") {
        return { kind: "discovered", term: existing.term, verdict, note: "This term is waiting for human review." }
      }
      if (existing && existing.status === "rejected") {
        await dependencies.logTermEvent(query, "search_miss")
        return { kind: "not_found", verdict, query }
      }

      await dependencies.logTermEvent(query, "search_miss")
      const discovered = await discoverTerm(query, dependencies.generateDiscoveryObject)
      if (!discovered) return { kind: "not_found", verdict, query }
      const saved = await dependencies.saveDiscoveredTerm(discovered.term)
      await dependencies.logTermEvent(query, "llm_generated")
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
}
