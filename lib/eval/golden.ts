import { readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"

// Golden-set format (eval/golden-set.json). One labelled case per entry.
//
// - safety:    expected gate verdict for an input (action, crisis, categories).
//              `categories` are the MINIMUM expected; extra detected categories
//              are fine unless you decide otherwise and document it.
// - discovery: whether the input is real slang, optionally its currency and the
//              minimum acceptable sensitivity rating, plus the expected gate
//              verdict (always "safe", or discovery would never run).
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

// Evaluation categories (W18EDATE-27). Every safety and discovery case has one,
// so results can be reported per category. Not the same as `safety.categories`,
// which lists the sensitive topics an input touches.
// - valid_slang:  real slang, including sensitive slang that is safe to look up;
// - non_slang:    ordinary words or phrases, including sensitive plain-English ones;
// - invented:     made-up words that look like slang (hallucination traps);
// - ambiguous:    harmless inputs that look risky, or words with two readings;
// - refusal:      inputs the gate should refuse;
// - safeguarding: inputs the gate should route to the safeguarding panel.
export const EVAL_CATEGORIES = ["valid_slang", "non_slang", "invented", "ambiguous", "refusal", "safeguarding"] as const
export type EvalCategory = (typeof EVAL_CATEGORIES)[number]

const base = {
  id: z.string().min(1),
  input: z.string().min(1).max(500),
  source: z.string().min(1),
  notes: z.string().optional(),
}

const expectedSafety = z.object({
  action: z.enum(["safe", "refuse", "safeguarding"]),
  crisis: z.enum(["self_harm", "harm_to_others"]).optional(),
  categories: z.array(z.enum(SAFETY_CATEGORIES)),
})

export const goldenCaseSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("safety"),
    category: z.enum(EVAL_CATEGORIES),
    safety: expectedSafety,
  }),
  z.object({
    ...base,
    kind: z.literal("discovery"),
    category: z.enum(EVAL_CATEGORIES),
    safety: expectedSafety,
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

// Second-reviewer record (W18EDATE-27, T2.3). Filled in by the reviewer, not the
// author: who checked the labels, which version they checked, and every case
// they disagreed with, marked resolved (label agreed or fixed) or flagged (open).
const reviewSchema = z.object({
  reviewer: z.string().min(1),
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD"),
  version: z.string().min(1),
  disagreements: z.array(
    z.object({
      id: z.string().min(1),
      note: z.string().min(1),
      status: z.enum(["resolved", "flagged"]),
    }),
  ),
})

export const goldenSetSchema = z.object({
  version: z.string(),
  description: z.string().optional(),
  review: reviewSchema.optional(),
  cases: z.array(goldenCaseSchema),
})

export type GoldenCase = z.infer<typeof goldenCaseSchema>
export type GoldenSet = z.infer<typeof goldenSetSchema>
export type GoldenReview = z.infer<typeof reviewSchema>

/** Sensitivity ratings from least to most restrictive (for minSensitivity checks). */
export const RATING_ORDER: readonly string[] = RATINGS

export function loadGoldenSet(file = path.join(process.cwd(), "eval", "golden-set.json")): GoldenSet {
  const parsed = goldenSetSchema.parse(JSON.parse(readFileSync(file, "utf8")))
  const seen = new Set<string>()
  for (const c of parsed.cases) {
    if (seen.has(c.id)) throw new Error(`Duplicate golden-set id: ${c.id}`)
    seen.add(c.id)
  }
  const problems = parsed.cases.flatMap(labelProblems)
  if (problems.length) throw new Error(`Inconsistent golden-set labels:\n  ${problems.join("\n  ")}`)
  const reviewIssues = reviewProblems(parsed)
  if (reviewIssues.length) throw new Error(`Invalid golden-set review:\n  ${reviewIssues.join("\n  ")}`)
  return parsed
}

/** Checks that every disagreement in the second review points at a case in the set. */
export function reviewProblems(set: GoldenSet): string[] {
  const ids = new Set(set.cases.map((c) => c.id))
  return (set.review?.disagreements ?? [])
    .filter((d) => !ids.has(d.id))
    .map((d) => `review: disagreement refers to unknown case id "${d.id}"`)
}

/** Checks that a case's category agrees with its expected outcome. Returns one message per problem. */
export function labelProblems(c: GoldenCase): string[] {
  if (c.kind === "safety") {
    const problems: string[] = []
    if ((c.category === "safeguarding") !== (c.safety.action === "safeguarding")) {
      problems.push(`${c.id}: category "${c.category}" does not match action "${c.safety.action}"`)
    }
    if ((c.category === "refusal") !== (c.safety.action === "refuse")) {
      problems.push(`${c.id}: category "${c.category}" does not match action "${c.safety.action}"`)
    }
    return [...new Set(problems)]
  }
  if (c.kind === "discovery") {
    const problems: string[] = []
    if (c.category === "safeguarding" || c.category === "refusal") {
      problems.push(`${c.id}: discovery cases cannot use category "${c.category}" (use a safety case)`)
    }
    if (c.safety.action !== "safe") {
      problems.push(`${c.id}: discovery cases must expect action "safe", or discovery never runs`)
    }
    if (c.category === "valid_slang" && !c.discovery.isRealSlang) {
      problems.push(`${c.id}: category "valid_slang" but isRealSlang is false`)
    }
    if (c.category !== "valid_slang" && c.category !== "ambiguous" && c.discovery.isRealSlang) {
      problems.push(`${c.id}: category "${c.category}" but isRealSlang is true`)
    }
    return problems
  }
  return []
}
