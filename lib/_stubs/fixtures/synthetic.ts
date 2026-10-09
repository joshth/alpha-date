// SYNTHETIC DATA — generated, not collected. Nothing here came from real users.
//
// Search-event histories follow a known lifecycle "shape" per term, so Aura
// scoring can be tested against ground truth. The shape labels below are the
// generator's intent, not the expected Aura output: your scoring rules decide
// stages; use these to sanity-check them and to write tests.

export type SyntheticShape = "emerging" | "peaking" | "declining" | "steady" | "faded"

export const HISTORY_DAYS = 180

// Seed-lexicon terms (lower-case) → generated shape. Terms not listed get "steady".
export const SYNTHETIC_SHAPES: Record<string, SyntheticShape> = {
  "delulu": "emerging",
  "situationship": "emerging",
  "the roman empire": "emerging",
  "rizz": "peaking",
  "skibidi": "peaking",
  "gyatt": "peaking",
  "simp": "declining",
  "sus": "declining",
  "npc": "declining",
  "poggers": "faded",
  "cheugy": "faded",
  "big yikes": "faded",
}

/** Expected daily search volume for a shape at day d (0 = oldest, HISTORY_DAYS - 1 = today). */
export function expectedDailyVolume(shape: SyntheticShape, d: number, base: number): number {
  const x = d / (HISTORY_DAYS - 1) // 0..1
  switch (shape) {
    case "emerging":
      return base * 0.05 + base * 1.6 * Math.pow(x, 3)
    case "peaking":
      return base * (0.3 + 1.4 * Math.exp(-Math.pow((x - 0.8) / 0.12, 2)))
    case "declining":
      return base * (0.2 + 1.3 * Math.exp(-Math.pow((x - 0.25) / 0.2, 2)))
    case "faded":
      return base * (0.08 + 0.5 * Math.max(0, 1 - x * 2.5))
    case "steady":
    default:
      return base * 0.6
  }
}

// Missing-term suggestions as users actually type them: spelling variants,
// repeated letters, punctuation, spacing and near-duplicates of each other and
// of existing lexicon terms. Stored lower-cased and trimmed (production
// behaviour), so case-only variants have already merged.
export const SYNTHETIC_SUGGESTIONS: { suggestedTerm: string; count: number; context?: string }[] = [
  { suggestedTerm: "rizzler", count: 14 },
  { suggestedTerm: "rizzlr", count: 2 },
  { suggestedTerm: "rizzzz", count: 3 },
  { suggestedTerm: "gyatt", count: 9 },
  { suggestedTerm: "gyat!!", count: 2 },
  { suggestedTerm: "aura farming", count: 11, context: "my son keeps saying he is aura farming" },
  { suggestedTerm: "aurafarming", count: 4 },
  { suggestedTerm: "aura-farming", count: 1 },
  { suggestedTerm: "six seven", count: 6 },
  { suggestedTerm: "6 7", count: 8 },
  { suggestedTerm: "brain rot", count: 7 },
  { suggestedTerm: "brainrot", count: 12 },
  { suggestedTerm: "crash out", count: 5 },
  { suggestedTerm: "crashout", count: 3 },
  { suggestedTerm: "crashing out", count: 2 },
  { suggestedTerm: "glazing", count: 6 },
  { suggestedTerm: "glaze", count: 2 },
  { suggestedTerm: "huzz", count: 4 },
  { suggestedTerm: "mewing", count: 5 },
  { suggestedTerm: "mewwing", count: 1 },
  { suggestedTerm: "skibidy", count: 2 },
  { suggestedTerm: "fanum-tax", count: 1 },
  { suggestedTerm: "delulu is the solulu", count: 3 },
  { suggestedTerm: "chopped", count: 4 },
  { suggestedTerm: "tuff", count: 3 },
  { suggestedTerm: "zorbleflux", count: 1, context: "heard it at school" },
  { suggestedTerm: "asdfgh", count: 1 },
]

// AI-discovered terms awaiting human review (as production's discovery would
// leave them). Definitions are synthetic.
export const SYNTHETIC_PENDING_TERMS = [
  {
    term: "Chopped",
    definition: "Unattractive or looking bad; the opposite of looking good.",
    sensitivityRating: "Use With Caution",
  },
  {
    term: "Tuff",
    definition: "Impressive or cool; a respelling of 'tough' used as praise.",
    sensitivityRating: "Generally Harmless",
  },
  {
    term: "Zorbleflux",
    definition: "A feeling of excitement before a weekend.",
    sensitivityRating: "Generally Harmless",
  },
]
