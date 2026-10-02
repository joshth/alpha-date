import type { SlangTerm } from "@/app/types"
import { buildDiscoveryPrompt, type DiscoveryOutput } from "./prompt"

// Term discovery, extracted from production. The model call is INJECTED so the
// evaluation harness can run the exact same logic against mock, real, or
// alternative prompt versions — keep it that way.
//
// Post-processing rules carried over from production incidents:
// - no definition → no term (blank "Generally Harmless" cards were published);
// - the term name is always the user's search, never model output (models
//   leaked reasoning text into the name field);
// - a missing rating defaults to caution, never to harmless.

export type GenerateDiscovery = (input: { prompt: string; searchTerm: string }) => Promise<DiscoveryOutput>

export interface DiscoveryResult {
  term: SlangTerm
  raw: DiscoveryOutput
}

export function toDiscoveredTerm(searchTerm: string, raw: DiscoveryOutput, today = new Date()): SlangTerm | null {
  const definition = raw.definition?.trim()
  if (!raw.isLegit || !definition) return null
  return {
    id: `discovered-${today.getTime()}`,
    term: searchTerm,
    pronunciation: "",
    definition,
    examples: raw.examples || [],
    originAndContext: raw.originAndContext || "Origin not yet documented.",
    commonSentiment: raw.commonSentiment || "Neutral",
    sensitivityRating: raw.sensitivityRating || "Use With Caution",
    cautionaryNotes: null,
    tags: ["auto-discovered", "unverified"],
    detailedOriginEtymology: `Discovered via AI analysis on ${today.toISOString().split("T")[0]}.`,
    educatorDiscussionPoints: [],
  }
}

export async function discoverTerm(
  searchTerm: string,
  generate: GenerateDiscovery,
  buildPrompt: (searchTerm: string) => string = buildDiscoveryPrompt,
): Promise<DiscoveryResult | null> {
  const raw = await generate({ prompt: buildPrompt(searchTerm), searchTerm })
  const term = toDiscoveredTerm(searchTerm, raw)
  return term ? { term, raw } : null
}
