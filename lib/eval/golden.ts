import { readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"

// Golden-set format (eval/golden-set.json). One labelled case per entry.
//
// - safety:    expected gate verdict for an input (action, crisis, categories).
//              `categories` are the MINIMUM expected; extra detected categories
//              are fine unless you decide otherwise and document it.
// - discovery: whether the input is real slang, optionally its currency and the
//              minimum acceptable sensitivity rating.
// - dedup:     whether `input` and `candidate` are the same term (for measuring
//              merge precision/recall of your normalisation).
//
// Rules: synthetic or publicly documented inputs only — never real user
// searches or anything copied from a real person's messages. Entries with
// source "prod-regression" mirror production CI; don't relax their labels
// without WA AI Hub review.

const SAFETY_CATEGORIES = [
  "suicide_self_harm",
  "eating_disorder",
  "sexual_exploitation",
  "violence_threat",
  "bullying_harassment",
] as const

const RATINGS = ["Generally Harmless", "Use With Caution", "Mature Themes", "Offensive", "Vulgar"] as const

const base = {
  id: z.string().min(1),
  input: z.string().min(1).max(500),
  source: z.string().min(1),
  notes: z.string().optional(),
}

export const goldenCaseSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("safety"),
    safety: z.object({
      action: z.enum(["safe", "refuse", "safeguarding"]),
      crisis: z.enum(["self_harm", "harm_to_others"]).optional(),
      categories: z.array(z.enum(SAFETY_CATEGORIES)),
    }),
  }),
  z.object({
    ...base,
    kind: z.literal("discovery"),
    discovery: z.object({
      isRealSlang: z.boolean(),
      currency: z.enum(["current", "outdated"]).optional(),
      minSensitivity: z.enum(RATINGS).optional(),
    }),
  }),
  z.object({
    ...base,
    kind: z.literal("dedup"),
    dedup: z.object({ candidate: z.string().min(1), sameTerm: z.boolean() }),
  }),
])

export const goldenSetSchema = z.object({
  version: z.string(),
  description: z.string().optional(),
  cases: z.array(goldenCaseSchema),
})

export type GoldenCase = z.infer<typeof goldenCaseSchema>
export type GoldenSet = z.infer<typeof goldenSetSchema>

/** Sensitivity ratings from least to most restrictive (for minSensitivity checks). */
export const RATING_ORDER: readonly string[] = RATINGS

export function loadGoldenSet(file = path.join(process.cwd(), "eval", "golden-set.json")): GoldenSet {
  const parsed = goldenSetSchema.parse(JSON.parse(readFileSync(file, "utf8")))
  const seen = new Set<string>()
  for (const c of parsed.cases) {
    if (seen.has(c.id)) throw new Error(`Duplicate golden-set id: ${c.id}`)
    seen.add(c.id)
  }
  return parsed
}
