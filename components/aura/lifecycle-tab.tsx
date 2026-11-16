"use client"
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import { AuraBadge } from "./aura-badge"
import { AuraTrend } from "./aura-trend"
import { LifecycleCharts } from "./lifecycle-charts"
import { Skeleton } from "@/components/ui/skeleton"
import { AURA_STAGE_LABELS } from "@/lib/aura"
import type { AuraFitOutcome } from "@/app/lab/actions"
import type { AuraDashboardRow } from "@/lib/aura/fit"
import { auraTermPath } from "@/lib/aura/term-route"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const SOURCE = { vendored: "Google Trends", synthetic: "this site's search events" }
const mono = "font-mono tabular-nums whitespace-nowrap"
type DashboardSortKey = "term" | "aura" | "confidence"
type SortDirection = "ascending" | "descending"

export function sortAuraDashboardRows(rows: AuraDashboardRow[], key: DashboardSortKey, direction: SortDirection) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (key === "confidence" && (a.row.confidence === null || b.row.confidence === null)) {
        if (a.row.confidence !== b.row.confidence) return a.row.confidence === null ? 1 : -1
        return a.index - b.index
      }
      const compared = key === "confidence"
        ? a.row.confidence! - b.row.confidence!
        : (key === "term" ? a.row.term : a.row.stage ? AURA_STAGE_LABELS[a.row.stage] : "No stage yet")
          .localeCompare(key === "term" ? b.row.term : b.row.stage ? AURA_STAGE_LABELS[b.row.stage] : "No stage yet", "en-AU", { sensitivity: "base" })
      return compared === 0 ? a.index - b.index : direction === "ascending" ? compared : -compared
    })
    .map(({ row }) => row)
}

export function AuraDashboardTable({ rows }: { rows: AuraDashboardRow[] }) {
  const [sortKey, setSortKey] = useState<DashboardSortKey>("term")
  const [direction, setDirection] = useState<SortDirection>("ascending")
  const sortedRows = useMemo(() => sortAuraDashboardRows(rows, sortKey, direction), [rows, sortKey, direction])
  const sortBy = (key: DashboardSortKey) => {
    if (sortKey === key) setDirection((current) => current === "ascending" ? "descending" : "ascending")
    else { setSortKey(key); setDirection("ascending") }
  }
  const header = (key: DashboardSortKey, label: string) => (
    <TableHead scope="col" aria-sort={sortKey === key ? direction : "none"}>
      <button type="button" onClick={() => sortBy(key)} className="inline-flex items-center gap-1 hover:underline focus-visible:outline focus-visible:outline-2">
        {label}<span aria-hidden="true">{sortKey === key ? direction === "ascending" ? "↑" : "↓" : "↕"}</span>
      </button>
    </TableHead>
  )
  return (
    <section aria-labelledby="aura-dashboard-heading" className="space-y-3">
      <h2 id="aura-dashboard-heading" className="text-base font-semibold">Aura by term</h2>
      {rows.length ? (
        <Table>
          <TableCaption>Aura lifecycle stage and fit confidence for every term with recorded search data</TableCaption>
          <TableHeader><TableRow>
            {header("term", "Term")}
            {header("aura", "Aura")}
            {header("confidence", "Confidence")}
          </TableRow></TableHeader>
          <TableBody>{sortedRows.map(({ term, stage, confidence }) => (
            <TableRow key={term}>
              <TableCell>{term}</TableCell>
              <TableCell>{stage ? AURA_STAGE_LABELS[stage] : "No stage yet"}</TableCell>
              <TableCell className="font-mono tabular-nums">{confidence == null ? "—" : `${Math.round(confidence * 100)}%`}</TableCell>
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

export function LifecycleTab({ initialTerm = "", fitAction, dashboardRows }: {
  initialTerm?: string
  fitAction: (term: string) => Promise<AuraFitOutcome>
  dashboardRows?: AuraDashboardRow[]
}) {
  const id = useId()
  const [term, setTerm] = useState(initialTerm)
  const [outcome, setOutcome] = useState<AuraFitOutcome | null>(null)
  const [pending, start] = useTransition()
  const initialFitStarted = useRef(false)
  const run = (t: string) => { setTerm(t); start(async () => setOutcome(await fitAction(t))) }
  const openTerm = (rawTerm: string) => {
    const value = rawTerm.trim()
    if (value.length < 2 || value.length > 100) { run(value); return }
    window.location.assign(auraTermPath(value))
  }
  useEffect(() => {
    if (initialTerm && !initialFitStarted.current) {
      initialFitStarted.current = true
      start(async () => setOutcome(await fitAction(initialTerm)))
    }
  }, [fitAction, initialTerm])
  const status = pending ? "Fitting the SIRS model…" : !outcome ? "" : outcome.kind === "fit"
    ? `Fitted ${outcome.fit.term}: ${outcome.fit.stage ? AURA_STAGE_LABELS[outcome.fit.stage] : "No stage yet"}`
    : outcome.kind === "no_data" ? "No search data for this term" : outcome.message
  return (
    <div className="space-y-6">
      <form role="search" onSubmit={(e) => { e.preventDefault(); openTerm(term) }} className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs text-lab-muted">Term</label>
          <input id={id} name="term" value={term} onChange={(e) => setTerm(e.target.value)}
            className="h-9 w-64 rounded border border-lab-border-strong bg-lab-input px-3 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="h-9 rounded bg-lab-text px-4 text-sm font-medium text-lab-surface disabled:opacity-50">Search</button>
      </form>
      {dashboardRows && <AuraDashboardTable rows={dashboardRows} />}
      <div role="status" aria-live="polite" className="sr-only">{status}</div>
      {pending ? <Skeleton className="h-64" /> : outcome && (
        <>
          <LifecycleResult outcome={outcome} onPick={openTerm} />
          {outcome.kind === "fit" && <LifecycleCharts fit={outcome.fit} />}
        </>
      )}
    </div>
  )
}
