import { MAX_INJECTION_INPUT_LENGTH } from "@/lib/safety/injection"
import { redactPersonalInformationWithResult } from "@/lib/safety/privacy"
import { prepareSafetyInput } from "@/lib/safety/input"
import { discoverTerm } from "@/lib/discovery/discover"
import { MAX_INPUT_LENGTH, sanitizeUserText } from "@/lib/discovery/prompt"
import { normaliseSuggestion } from "@/lib/normalise"
import { safetyResponseMessage } from "@/lib/safety/responses"
import type { RequestSafetyCheck } from "@/lib/safety/gate"
import type { generateDiscoveryObject } from "@/lib/_stubs/llm"
import type { getTermByKey, logTermEvent, saveDiscoveredTerm } from "@/lib/terms-store"
import type { SearchOutcome } from "@/lib/types"

interface SearchDependencies {
  checkInputSafety: RequestSafetyCheck
  getTermByKey: typeof getTermByKey
  logTermEvent: typeof logTermEvent
  generateDiscoveryObject: typeof generateDiscoveryObject
  saveDiscoveredTerm: typeof saveDiscoveredTerm
}

export function createSearchTerm(dependencies: SearchDependencies) {
  return async (raw: string): Promise<SearchOutcome> => {
    if (typeof raw !== "string" || raw.length > MAX_INJECTION_INPUT_LENGTH) return {kind: "error", message: "Please enter a shorter slang term or phrase."}
    const validated = sanitizeUserText(raw, MAX_INPUT_LENGTH)
    const input = validated ? redactPersonalInformationWithResult(validated) : null
    const query = input?.text
    if (!query) return { kind: "error", message: `Please enter a term (up to ${MAX_INPUT_LENGTH} characters).` }

    const screening = redactPersonalInformationWithResult(prepareSafetyInput(raw))
    const original = redactPersonalInformationWithResult(raw.length <= 10000 ? raw : prepareSafetyInput(raw))
    const privacyRedacted = Boolean(input?.redacted || screening.redacted || original.redacted)
    const respond = (result: SearchOutcome): SearchOutcome => privacyRedacted ? { ...result, privacyRedacted: true } : result
    const verdict = await dependencies.checkInputSafety(screening.text, "search", original.text)
    if (verdict.action === "gentle_support") return respond({ kind: "gentle_support", verdict, message: safetyResponseMessage(verdict, "search") })
    if (verdict.action === "safeguarding") return respond({ kind: "safeguarding", verdict })
    if (verdict.action === "refuse") {
      return respond({ kind: "refused", verdict, message: safetyResponseMessage(verdict, "search") })
    }

    try {
      const existing = await dependencies.getTermByKey(normaliseSuggestion(query))
      if (existing) await dependencies.logTermEvent(query, "ai_call_avoided")
      if (existing && existing.status === "published") {
        await dependencies.logTermEvent(query, "search_hit")
        return respond({ kind: "found", term: existing.term, verdict })
      }
      if (existing && existing.status === "pending_review") {
        return respond({ kind: "discovered", term: existing.term, verdict, note: "This term is waiting for human review." })
      }
      if (existing && existing.status === "rejected") {
        await dependencies.logTermEvent(query, "search_miss")
        return respond({ kind: "not_found", verdict, query })
      }

      await dependencies.logTermEvent(query, "search_miss")
      const discovered = await discoverTerm(query, dependencies.generateDiscoveryObject)
      if (!discovered) return respond({ kind: "not_found", verdict, query })
      const saved = await dependencies.saveDiscoveredTerm(discovered.term)
      await dependencies.logTermEvent(query, "llm_generated")
      return respond({
        kind: "discovered",
        term: saved?.term ?? discovered.term,
        verdict,
        note: "AI-generated and unverified. Saved for human review before anyone else sees it.",
      })
    } catch {
      console.error("searchTerm failed.")
      return respond({ kind: "error", message: "Something went wrong looking that up. Please try again." })
    }
  }
}
