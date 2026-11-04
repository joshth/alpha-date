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
    safety: expectedSafety.extend({ action: z.enum(["safe", "gentle_support", "refuse", "safeguarding"]) }),
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
const noagreement = z.object({
      id: z.string().min(1),
      note: z.string().min(1),
      status: z.enum(["resolved", "flagged"]),
    });
const reviewSchema = z.object({
  reviewer: z.string().min(1),
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD"),
  version: z.string().min(1),
  disagreements: z.array(noagreement),
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

export const RATING_ORDER: readonly string[] = RATINGS

export const DEFAULT_GOLDEN_SET_PATH = path.join(
  process.cwd(),
  "eval",
  "golden-set.json"
);

export function validateGoldenSet(
  raw: unknown
): { set: GoldenSet | null; problems: string[] } {
  const result = goldenSetSchema.safeParse(raw);
  const problems: string[] = [];

  if (!result.success) {
    for (const issue of result.error.issues) {
      problems.push(describeIssue(raw, issue));
    }
  }

  const cases = (raw as { cases?: unknown })?.cases;
  const rawCases = Array.isArray(cases) ? cases : [];
  const ids = new Set<string>();

  for (const item of rawCases) {
    const id = (item as { id?: unknown })?.id;

    if (typeof id === "string" && id.length > 0) {
      if (ids.has(id)) {
        problems.push(`${id}: duplicate id`);
      }

      ids.add(id);
    }

    const caseResult = goldenCaseSchema.safeParse(item);

    if (caseResult.success) {
      const issues = labelProblems(caseResult.data);
      problems.push(...issues);
    }
  }

  if (result.success) {
    const issues = reviewProblems(result.data);
    problems.push(...issues.map((issue) => `review: ${issue}`));
  }

  if (!result.success || problems.length > 0) {
    return { set: null, problems };
  }

  return { set: result.data, problems };
}

export function loadGoldenSet(
  file = DEFAULT_GOLDEN_SET_PATH
): GoldenSet {
  let raw: unknown;

  try {
    const contents = readFileSync(file, "utf8");
    raw = JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Cannot read golden set ${file}: ${(error as Error).message}`
    );
  }

   const result = validateGoldenSet(raw);

  if (result.set === null) {
    throw new Error(
      `Invalid golden set ${file} (${result.problems.length} problems):\n  ` +
        result.problems.join("\n  ")
    );
  }

  return result.set;
}

function describeIssue(raw: unknown, issue: z.ZodIssue): string {
  const pathParts = issue.path;

  if (pathParts[0] === "cases" && typeof pathParts[1] === "number") {
    const index = pathParts[1];
    const remainingPath = pathParts.slice(2);
    const cases = (raw as { cases?: { id?: unknown }[] })?.cases;
    const item = cases?.[index];

    const id =
      typeof item?.id === "string" && item.id.length > 0
        ? item.id
        : "(no id)";

    const field = remainingPath.length
      ? remainingPath.join(".")
      : "case";

    return `${id} (cases[${index}]): ${field}: ${issue.message}`;
  }

  const field = pathParts.length > 0
    ? pathParts.join(".")
    : "file";

  return `${field}: ${issue.message}`;
}
export function reviewProblems(set: GoldenSet): string[] {
  const ids = new Set(set.cases.map((c) => c.id))
  return (set.review?.disagreements ?? [])
    .filter((d) => !ids.has(d.id))
    .map((d) => `disagreement refers to unknown case id "${d.id}"`)
}

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
