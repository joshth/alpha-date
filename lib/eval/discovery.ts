import { discoverTerm, type GenerateDiscovery } from "@/lib/discovery/discover"
import { buildDiscoveryPrompt } from "@/lib/discovery/prompt"
import { type EvalCategory, type GoldenCase, RATING_ORDER, type Split, type WordType } from "@/lib/eval/golden"
import { type Rate, rate } from "@/lib/eval/metrics"
import { isPromptInjection } from "@/lib/safety/injection"

// Discovery evaluation (W18EDATE-65, part of W18EDATE-29).
//
// Definitions, fixed before any run so a result can't move the goalposts:
// - "accepted" means discoverTerm(...) returned a term, i.e. the same rule the
//   app uses to decide what gets stored (isLegit AND a non-empty definition).
// - positive label = the golden set says isRealSlang: true.
// - precision = accepted real slang / all accepted;
//   recall    = accepted real slang / all real slang.
// - H1 hallucination rate = accepted "invented" words / all "invented" words.
//   Accepting a misspelling or an ordinary word is a false positive but not
//   H1; it is counted in falseAcceptRate (accepted non-slang / all non-slang).
// - sensitivity mislabel = an accepted case with a minSensitivity whose model
//   rating ranks lower in RATING_ORDER (e.g. "unalive" rated harmless).
// - a term the app refuses as an instruction (W18EDATE-146) counts as rejected.
// - a provider error is neither accepted nor rejected: the case is listed in
//   errorIds and left out of every denominator, so outages can't pass as
//   "the model said no".
// - byWordType / byDialect / bySplit (W18EDATE-70): the same recall and H1,
//   worked out inside each group, so a weak spot (e.g. AU slang, or plausible
//   made-up words) shows up instead of hiding in the overall number. A group
//   with no real slang (or no invented words) shows that rate as n/a.
// - options.split runs only the "dev" or the "held-out" cases.
//
// Only discovery cases are sent to the model. Safety cases are filtered out
// here, so their inputs never reach a provider or a report.

type DiscoveryCase = Extract<GoldenCase, { kind: "discovery" }>

export type Outcome = "true_positive" | "false_positive" | "false_negative" | "true_negative" | "error"

export interface DiscoveryCaseResult {
  id: string
  input: string
  category: EvalCategory
  wordType: WordType
  split: Split
  dialect: string
  isRealSlang: boolean
  accepted: boolean | null
  outcome: Outcome
  definition: string | null
  rating: string | null
  minSensitivity: string | null
  sensitivityMislabel: boolean
  latencyMs: number
  error: string | null
}

export interface EvaluateDiscoveryOptions {
  buildPrompt?: (searchTerm: string) => string
  now?: () => number
  split?: Split
}

// Recall and H1 inside one group of results (one word type, dialect or split).
export interface GroupRates {
  cases: number
  recall: Rate
  hallucinationRate: Rate
}

function ratesBy(scored: readonly DiscoveryCaseResult[], pick: (r: DiscoveryCaseResult) => string): Record<string, GroupRates> {
  const keys = [...new Set(scored.map(pick))].sort()
  return Object.fromEntries(
    keys.map((key) => {
      const group = scored.filter((r) => pick(r) === key)
      const real = group.filter((r) => r.isRealSlang)
      const invented = group.filter((r) => r.category === "invented")
      return [
        key,
        {
          cases: group.length,
          recall: rate(real.filter((r) => r.accepted).length, real.length),
          hallucinationRate: rate(invented.filter((r) => r.accepted).length, invented.length),
        },
      ]
    }),
  )
}

function outcomeFor(isRealSlang: boolean, accepted: boolean): Outcome {
  if (accepted) return isRealSlang ? "true_positive" : "false_positive"
  return isRealSlang ? "false_negative" : "true_negative"
}

function ranksBelow(rating: string | null, minimum: string | null): boolean {
  if (!rating || !minimum) return false
  return RATING_ORDER.indexOf(rating) < RATING_ORDER.indexOf(minimum)
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

export async function evaluateDiscovery(
  cases: readonly GoldenCase[],
  generate: GenerateDiscovery,
  { buildPrompt = buildDiscoveryPrompt, now = () => performance.now(), split }: EvaluateDiscoveryOptions = {},
) {
  const labelled = cases.filter(
    (entry): entry is DiscoveryCase => entry.kind === "discovery" && (split === undefined || entry.discovery.split === split),
  )
  const results: DiscoveryCaseResult[] = []

  for (const entry of labelled) {
    const started = now()
    let accepted: boolean | null = null
    let definition: string | null = null
    let rating: string | null = null
    let error: string | null = null
    try {
      const found = await discoverTerm(entry.input, generate, buildPrompt)
      accepted = found !== null
      definition = found?.term.definition ?? null
      rating = found?.term.sensitivityRating ?? null
    } catch (caught) {
      // The app refuses instructions posing as a word before any model runs
      // (W18EDATE-146). That is the app saying "not slang", so it is scored as
      // a rejection, not as a provider error.
      if (isPromptInjection(entry.input)) accepted = false
      else error = caught instanceof Error ? caught.message : "Discovery failed."
    }
    const latencyMs = now() - started
    const minSensitivity = entry.discovery.minSensitivity ?? null
    results.push({
      id: entry.id,
      input: entry.input,
      category: entry.category,
      wordType: entry.discovery.wordType,
      split: entry.discovery.split,
      dialect: entry.discovery.dialect,
      isRealSlang: entry.discovery.isRealSlang,
      accepted,
      outcome: accepted === null ? "error" : outcomeFor(entry.discovery.isRealSlang, accepted),
      definition,
      rating,
      minSensitivity,
      sensitivityMislabel: accepted === true && ranksBelow(rating, minSensitivity),
      latencyMs,
      error,
    })
  }

  const scored = results.filter((r) => r.outcome !== "error")
  const count = (outcome: Outcome) => scored.filter((r) => r.outcome === outcome).length
  const confusion = {
    truePositive: count("true_positive"),
    falsePositive: count("false_positive"),
    falseNegative: count("false_negative"),
    trueNegative: count("true_negative"),
  }
  const invented = scored.filter((r) => r.category === "invented")
  const nonSlang = scored.filter((r) => !r.isRealSlang)
  const withMinimum = scored.filter((r) => r.accepted && r.minSensitivity !== null)

  const byCategory = Object.fromEntries(
    [...new Set(scored.map((r) => r.category))].map((category) => {
      const inCategory = scored.filter((r) => r.category === category)
      return [category, rate(inCategory.filter((r) => r.accepted).length, inCategory.length)]
    }),
  )

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b)
  const totalMs = latencies.reduce((sum, ms) => sum + ms, 0)

  return {
    total: results.length,
    scored: scored.length,
    confusion,
    precision: rate(confusion.truePositive, confusion.truePositive + confusion.falsePositive),
    recall: rate(confusion.truePositive, confusion.truePositive + confusion.falseNegative),
    hallucinationRate: rate(invented.filter((r) => r.accepted).length, invented.length),
    falseAcceptRate: rate(nonSlang.filter((r) => r.accepted).length, nonSlang.length),
    sensitivityMislabelRate: rate(withMinimum.filter((r) => r.sensitivityMislabel).length, withMinimum.length),
    acceptedByCategory: byCategory,
    byWordType: ratesBy(scored, (r) => r.wordType),
    byDialect: ratesBy(scored, (r) => r.dialect),
    bySplit: ratesBy(scored, (r) => r.split),
    hallucinatedIds: invented.filter((r) => r.accepted).map((r) => r.id),
    falsePositiveIds: scored.filter((r) => r.outcome === "false_positive").map((r) => r.id),
    falseNegativeIds: scored.filter((r) => r.outcome === "false_negative").map((r) => r.id),
    sensitivityMislabelIds: withMinimum.filter((r) => r.sensitivityMislabel).map((r) => r.id),
    errorIds: results.filter((r) => r.outcome === "error").map((r) => r.id),
    calls: results.length,
    latency: {
      totalMs,
      meanMs: results.length === 0 ? null : totalMs / results.length,
      p95Ms: percentile(latencies, 95),
    },
    results,
  }
}

export type DiscoveryEvaluation = Awaited<ReturnType<typeof evaluateDiscovery>>
