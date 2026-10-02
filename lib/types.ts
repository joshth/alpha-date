import type { SlangTerm } from "@/app/types"
import type { SafetyVerdict } from "@/lib/safety/gate"

export interface ActionResult<T = undefined> {
  success: boolean
  message: string
  data?: T
}

export type SearchOutcome =
  | { kind: "safeguarding"; verdict: SafetyVerdict }
  | { kind: "refused"; verdict: SafetyVerdict; message: string }
  | { kind: "found"; term: SlangTerm; verdict: SafetyVerdict }
  | { kind: "discovered"; term: SlangTerm; verdict: SafetyVerdict; note: string }
  | { kind: "not_found"; verdict: SafetyVerdict; query: string }
  | { kind: "error"; message: string }
