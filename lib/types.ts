import type { SlangTerm } from "@/app/types"
import type { SafetyVerdict } from "@/lib/safety/gate"

export interface ActionResult<T = undefined> {
  success: boolean
  message: string
  privacyRedacted?: boolean
  data?: T
}

type SearchResult =
  | { kind: "gentle_support"; verdict: SafetyVerdict; message: string }
  | { kind: "safeguarding"; verdict: SafetyVerdict }
  | { kind: "refused"; verdict: SafetyVerdict; message: string }
  | { kind: "found"; term: SlangTerm; verdict: SafetyVerdict }
  | { kind: "discovered"; term: SlangTerm; verdict: SafetyVerdict; note: string }
  | { kind: "not_found"; verdict: SafetyVerdict; query: string }
  | { kind: "error"; message: string }

export type SearchOutcome = SearchResult & { privacyRedacted?: boolean }
