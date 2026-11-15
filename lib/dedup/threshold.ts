import { findLikelyMatches } from "@/lib/normalise"

export function mergeQuality(cases: { input: string; candidate: string; sameTerm: boolean }[], threshold: number) {
  const q = { tp: 0, fp: 0, fn: 0, tn: 0 }
  for (const c of cases) {
    const merge = findLikelyMatches(c.input, [c.candidate]).some((m) => m.score >= threshold)
    q[c.sameTerm ? (merge ? "tp" : "fn") : merge ? "fp" : "tn"]++
  }
  return { ...q, precision: q.tp + q.fp ? q.tp / (q.tp + q.fp) : null, recall: q.tp + q.fn ? q.tp / (q.tp + q.fn) : null }
}
