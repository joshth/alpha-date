"use client"
import { useEffect, useId, useState, useTransition } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { GraphExplorer } from "@/components/aura/similarity-graph-explorer"
import type { DedupGraphData } from "@/lib/dedup/graph"
import type { DedupSavings } from "@/lib/dedup/savings"

const mono = "font-mono tabular-nums whitespace-nowrap"
const formatBytes = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} kB`)

function MinutesInput({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-lab-muted">Minutes per review</label>
      <input id={id} type="number" min="0" step="1" value={value} onChange={(e) => onChange?.(e.target.valueAsNumber)}
        className="h-9 w-20 rounded border border-lab-border-strong bg-lab-input px-3 text-sm" />
    </div>
  )
}

export function DedupResult({ savings, minutesPerReview, onMinutesChange }: { savings: DedupSavings; minutesPerReview: number; onMinutesChange?: (n: number) => void }) {
  if (savings.rawRows === 0) return <p className="text-sm text-lab-muted">No suggestions yet</p>
  const stats: [string, string][] = [
    ["Rows before", String(savings.rawRows)], ["Distinct keys", String(savings.distinctKeys)], ["Rows merged", String(savings.merged)],
    ["Reduction", `${savings.reductionPct}%`], ["Storage saved", formatBytes(savings.storageSavedBytes)], ["Review items saved", String(savings.reviewItemsSaved)],
  ]
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-lab-border py-3 sm:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-lab-muted">{k}</dt>
            <dd className={`mt-1 text-sm ${mono}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 border-t border-lab-border pt-3">
        <span className="text-xs uppercase text-lab-muted">Estimate</span>
        <p className="text-sm">{savings.estimate.minutesSaved} min saved at {savings.estimate.assumption}</p>
        <MinutesInput value={minutesPerReview} onChange={onMinutesChange} />
        <p className="text-xs text-lab-muted">Baseline: exact match on trimmed lower case</p>
      </div>
    </div>
  )
}

export function DedupTab({ savingsAction, graphAction }: { savingsAction: (minutesPerReview: number) => Promise<DedupSavings>; graphAction: () => Promise<DedupGraphData> }) {
  const [minutes, setMinutes] = useState(2)
  const [savings, setSavings] = useState<DedupSavings | null>(null)
  const [pending, start] = useTransition()
  useEffect(() => { start(async () => setSavings(await savingsAction(minutes))) }, [minutes, savingsAction])
  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite" className="sr-only">{pending ? "Updating…" : savings ? "Dedup counts updated" : ""}</div>
      {savings ? <DedupResult savings={savings} minutesPerReview={minutes} onMinutesChange={(n) => setMinutes(Number.isFinite(n) ? n : 2)} /> : <><MinutesInput value={minutes} onChange={(n) => setMinutes(Number.isFinite(n) ? n : 2)} /><Skeleton className="h-24" /></>}
      <GraphExplorer graphAction={graphAction} />
    </div>
  )
}
