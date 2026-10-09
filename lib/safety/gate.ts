import { assessSafety, type CrisisKind, type SafetyCategory } from "@/lib/safety/classify"

// INTEGRATION CONTRACT — input safety gate (team-owned; Sprints 1-2).
//
// checkInputSafety runs on every search / suggestion BEFORE any AI call.
//
//   safe          → proceed. `categories` may be non-empty: a sensitive LOOKUP
//                   (e.g. someone searching "kms") is allowed, and the UI shows
//                   help resources alongside the answer.
//   refuse        → do not process; show a calm, plain-English refusal.
//   safeguarding  → do not process; show the safeguarding panel (crisis card).
//
// BASELINE (shipped below): production's deterministic rules only
// (lib/safety/classify.ts — copied verbatim from production on 2 Oct 2026).
//
// YOUR WORK, per the approved scope:
// 1. Combine the rules with the moderation endpoint (lib/_stubs/moderation.ts),
//    deciding how provider categories map to the verdicts above.
// 2. Fail closed: if the moderation provider is unavailable, the gate must not
//    silently pass content it would otherwise have checked. Design what
//    "closed" means for each surface (search vs suggestion) and justify it.
// 3. Improve the rules themselves where the golden set shows misses or false
//    positives — every change measured by `pnpm eval`, and every fixed miss
//    added as a golden-set case so it becomes a regression test in production.
// The function signature and verdict shape are the contract; extend the
// object with new optional fields rather than changing existing ones.

export type SafetyAction = "safe" | "refuse" | "safeguarding"

export interface SafetyVerdict {
  action: SafetyAction
  categories: SafetyCategory[]
  crisis: CrisisKind | null
  /** Which layer decided: deterministic rules, moderation endpoint, or fail-closed fallback. */
  decidedBy: "rules" | "moderation" | "fail_closed"
  /** Short machine-readable reason, for logs and the eval report. Never the input text. */
  reason: string
}

export type SafetySurface = "search" | "suggestion"

export async function checkInputSafety(text: string, _surface: SafetySurface = "search"): Promise<SafetyVerdict> {
  const assessment = assessSafety(text)
  if (assessment.crisis) {
    return {
      action: "safeguarding",
      categories: assessment.categories,
      crisis: assessment.crisis,
      decidedBy: "rules",
      reason: `crisis:${assessment.crisis}`,
    }
  }
  // TODO(Sprint 1-2): consult the moderation endpoint and fail closed.
  return {
    action: "safe",
    categories: assessment.categories,
    crisis: null,
    decidedBy: "rules",
    reason: assessment.categories.length ? "sensitive_lookup" : "no_signal",
  }
}
