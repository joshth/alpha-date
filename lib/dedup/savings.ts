import { normaliseSuggestion } from "@/lib/normalise"

export interface DedupRow { suggestedTerm: string; count: number; status: string; bytes?: number }
export interface DedupSavings {
  rawRows: number
  distinctKeys: number
  merged: number
  reductionPct: number
  reviewItemsSaved: number
  storageSavedBytes: number
  submissions: number
  estimate: { minutesSaved: number; assumption: string }
}

// Rows arrive highest-count-first; the first row of each key group is the one kept.
export function dedupSavings(rows: DedupRow[], minutesPerReview = 2): DedupSavings {
  const groups = new Map<string, DedupRow[]>()
  for (const r of rows) {
    const key = normaliseSuggestion(r.suggestedTerm)
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  let reviewItemsSaved = 0
  let storageSavedBytes = 0
  for (const g of groups.values()) {
    reviewItemsSaved += Math.max(0, g.filter(r => r.status === "pending").length - 1)
    storageSavedBytes += g.slice(1).reduce((n, r) => n + (r.bytes ?? 0), 0)
  }
  const merged = rows.length - groups.size
  return {
    rawRows: rows.length,
    distinctKeys: groups.size,
    merged,
    reductionPct: rows.length ? Math.round((merged / rows.length) * 1000) / 10 : 0,
    reviewItemsSaved,
    storageSavedBytes,
    submissions: rows.reduce((n, r) => n + r.count, 0),
    estimate: { minutesSaved: reviewItemsSaved * minutesPerReview, assumption: `${minutesPerReview} min per review` },
  }
}
