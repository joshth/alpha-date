"use client"
import { useId, useState, useTransition } from "react"
import { AuraBadge } from "./aura-badge"
import { AuraTrend } from "./aura-trend"
import { LifecycleCharts } from "./lifecycle-charts"
import { Skeleton } from "@/components/ui/skeleton"
import { AURA_STAGE_LABELS } from "@/lib/aura"
import type { AuraFitOutcome } from "@/app/lab/actions"
import type { AuraDashboardRow } from "@/lib/aura/fit"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const SOURCE = { vendored: "Google Trends", synthetic: "this site's search events" }
const mono = "font-mono tabular-nums whitespace-nowrap"

export function AuraDashboardTable({ rows }: { rows: AuraDashboardRow[] }) {
  return (
    <section aria-labelledby="aura-dashboard-heading" className="space-y-3">
      <h2 id="aura-dashboard-heading" className="text-base font-semibold">Aura by term</h2>
      {rows.length ? (
        <Table>
          <TableCaption>Aura lifecycle stage for every term with recorded search data</TableCaption>
          <TableHeader><TableRow>
            <TableHead scope="col">Term</TableHead>
            <TableHead scope="col">Aura</TableHead>
          </TableRow></TableHeader>
          <TableBody>{rows.map(({ term, stage }) => (
            <TableRow key={term}>
              <TableCell>{term}</TableCell>
              <TableCell>{stage ? AURA_STAGE_LABELS[stage] : "No stage yet"}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      ) : <p className="text-sm text-lab-muted">No terms with search data yet.</p>}
    </section>
  )
}

export function LifecycleResult({ outcome, onPick }: { outcome: AuraFitOutcome; onPick?: (term: string) => void }) {
  if (outcome.kind === "blocked" || outcome.kind === "invalid")
    return <p role="alert" className="text-sm text-lab-text">{outcome.message}</p>
  if (outcome.kind === "no_data")
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold">No search data for this term</h2>
        <p className="text-sm text-lab-muted">Nothing found for <span className="text-lab-text">{outcome.term}</span>.</p>
        {outcome.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-lab-muted">Did you mean</span>
            {outcome.suggestions.slice(0, 3).map((s) => (
              <button key={s} type="button" data-suggestion={s} onClick={() => onPick?.(s)}
                className="h-8 rounded border border-lab-border-strong px-3 hover:bg-lab-input">{s}</button>
            ))}
          </div>
        )}
      </div>
    )
  const { fit, source, stageNote } = outcome
  const stats: [string, React.ReactNode][] = [
    ["Stage", <AuraBadge key="stage" stage={fit.stage} confidence={fit.confidence} />],
    ["r", fit.r.toFixed(2)], ["Δ", fit.delta.toFixed(2)], ["Peak week", fit.peakWeek], ["Confidence", `${Math.round(fit.confidence * 100)}%`],
  ]
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-lab-border py-3 sm:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))]">
        {stats.map(([k, v], i) => (
          <div key={k}>
            <dt className="text-xs text-lab-muted">{k}</dt>
            <dd className={`mt-1 text-sm ${i ? mono : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <AuraTrend fit={fit} />
      {stageNote && <p className="text-sm text-lab-muted">{stageNote}</p>}
      <p className="text-xs text-lab-muted">Source: {SOURCE[source]}</p>
    </div>
  )
}

export function LifecycleTab({ fitAction }: { fitAction: (term: string) => Promise<AuraFitOutcome> }) {
  const id = useId()
  const [term, setTerm] = useState("")
  const [outcome, setOutcome] = useState<AuraFitOutcome | null>(null)
  const [pending, start] = useTransition()
  const run = (t: string) => { setTerm(t); start(async () => setOutcome(await fitAction(t))) }
  const status = pending ? "Fitting the SIRS model…" : !outcome ? "" : outcome.kind === "fit"
    ? `Fitted ${outcome.fit.term}: ${outcome.fit.stage ? AURA_STAGE_LABELS[outcome.fit.stage] : "No stage yet"}`
    : outcome.kind === "no_data" ? "No search data for this term" : outcome.message
  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); run(term) }} className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs text-lab-muted">Term</label>
          <input id={id} name="term" value={term} onChange={(e) => setTerm(e.target.value)}
            className="h-9 w-64 rounded border border-lab-border-strong bg-lab-input px-3 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="h-9 rounded bg-lab-text px-4 text-sm font-medium text-lab-surface disabled:opacity-50">Fit</button>
      </form>
      <div role="status" aria-live="polite" className="sr-only">{status}</div>
      {pending ? <Skeleton className="h-64" /> : outcome && (
        <>
          <LifecycleResult outcome={outcome} onPick={run} />
          {outcome.kind === "fit" && <LifecycleCharts fit={outcome.fit} />}
        </>
      )}
    </div>
  )
}
