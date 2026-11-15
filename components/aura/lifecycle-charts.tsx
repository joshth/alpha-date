"use client"
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ChartPanel } from "./chart-panel"
import type { SirsFit } from "@/lib/aura/fit-command"
import { lifecycleRows, trendSentence, windowBounds } from "@/lib/aura/trend-text"
import { AURA_STAGE_LABELS, type AuraStage } from "@/lib/aura"
import { fittedStages } from "@/lib/aura/stage-regions"

type Series = { key: string; label: string; color: string; dash: string; shape: "dot" | "line" }
const tok = (n: string) => `hsl(var(--lab-${n}))`
export const MAIN_SERIES: Series[] = [
  { key: "interest", label: "Search interest", color: tok("text-muted"), dash: "1 3", shape: "dot" },
  { key: "fitted", label: "Fitted curve", color: tok("primary"), dash: "0", shape: "line" },
]
export const SHARE_SERIES: Series[] = [
  { key: "susceptible", label: "Susceptible", color: tok("stage-declining"), dash: "0", shape: "line" },
  { key: "infected", label: "Infected", color: tok("stage-peaking"), dash: "6 3", shape: "line" },
  { key: "recovered", label: "Recovered", color: tok("stage-parent-territory"), dash: "2 3", shape: "line" },
]
export const FEEDBACK_SERIES: Series[] = [
  { key: "feedback", label: "Feedback Γ(t)", color: tok("stage-emerging"), dash: "8 3 2 3", shape: "line" },
]
export const CHART_REFS = { peakLine: 0.8 }

type Move = 1 | -1 | "home" | "end"
const KEYS: Record<string, Move> = { ArrowRight: 1, ArrowLeft: -1, Home: "home", End: "end" }

/** recharts `dot`: one roving-tabindex stop per chart (WCAG 2.1.1). */
export function FocusDot({ cx, cy, index, payload, tabbable, active, onFocusPoint, onMove }: {
  cx?: number; cy?: number; index?: number; tabbable?: boolean; active?: boolean
  payload?: { week: string; interest: number; fitted: number }
  onFocusPoint?: (index: number) => void; onMove?: (delta: Move) => void
}) {
  if (cx === undefined || cy === undefined) return null
  const label = payload ? `Week ${payload.week}: interest ${payload.interest.toFixed(2)}, fitted ${payload.fitted.toFixed(2)}` : undefined
  const onKeyDown = (e: KeyboardEvent<SVGCircleElement>) => {
    const m = KEYS[e.key]
    if (m !== undefined) { e.preventDefault(); onMove?.(m) }
  }
  return (
    <circle cx={cx} cy={cy} r={active ? 5 : 4} tabIndex={tabbable ? 0 : -1} role="img" aria-label={label} data-index={index}
      fill={tok("text-muted")} stroke={active ? tok("text") : "none"} strokeWidth={active ? 2 : 0}
      className="outline-none focus-visible:stroke-[hsl(var(--lab-text))] focus-visible:[stroke-width:3px]"
      onFocus={() => index !== undefined && onFocusPoint?.(index)} onKeyDown={onKeyDown} />
  )
}

const config = (...s: Series[][]): ChartConfig =>
  Object.fromEntries(s.flat().map((x) => [x.key, { label: x.label, color: x.color }]))
const tick = { fill: tok("text-muted"), fontSize: 12 }
const STAGES: { key: AuraStage; token: string; pattern: "diagonal" | "dots" | "cross" | "horizontal" }[] = [
  { key: "emerging", token: "stage-emerging", pattern: "diagonal" },
  { key: "peaking", token: "stage-peaking", pattern: "dots" },
  { key: "declining", token: "stage-declining", pattern: "cross" },
  { key: "parent_territory", token: "stage-parent-territory", pattern: "horizontal" },
]
// An array, not a fragment: Recharts only registers axes and the grid when they are direct children.
const axes = [
  <CartesianGrid key="grid" vertical={false} stroke={tok("border")} />,
  <XAxis key="x" dataKey="week" tickLine={false} tickFormatter={(w: string) => w.slice(0, 7)} interval="preserveStartEnd" minTickGap={48} padding={{ left: 4, right: 28 }} tick={tick} stroke={tok("border-strong")} />,
  <YAxis key="y" width={40} tickLine={false} tick={tick} tickFormatter={(v: number) => Number(v).toFixed(2)} domain={[0, "auto"]} stroke={tok("border-strong")} />,
  <ChartTooltip key="tip" content={<ChartTooltipContent />} />,
]
export function SeriesLegend({ series }: { series: typeof MAIN_SERIES }) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-lab-muted">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <svg aria-hidden="true" width="24" height="8">
            {s.shape === "line"
              ? <line x1="0" y1="4" x2="24" y2="4" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
              : <circle cx="12" cy="4" r="3" fill={s.color} />}
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  )
}
const lines = (series: Series[]) => series.map((s) => (
  <Line key={s.key} dataKey={s.key} type="monotone" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} dot={false} isAnimationActive={false} />
))
const cols = (series: Series[]) => [{ key: "week", label: "Week" }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))]

export function LifecycleCharts({ fit }: { fit: SirsFit }) {
  const rows = useMemo(() => lifecycleRows(fit), [fit])
  const stages = useMemo(() => fittedStages(rows.map((row) => row.fitted)), [rows])
  const stagedRows = useMemo(() => rows.map((row, i) => ({
    ...row,
    stage: stages[i] ? AURA_STAGE_LABELS[stages[i]!] : "Insufficient history",
    ...Object.fromEntries(STAGES.map(({ key }) => [`region_${key}`, stages[i] === key ? row.fitted : null])),
  })), [rows, stages])
  const win = useMemo(() => windowBounds(rows.map((r) => r.week), fit.windowStart, fit.now), [rows, fit.windowStart, fit.now])
  const summary = trendSentence(fit)
  const [focus, setFocus] = useState(rows.length - 1)
  const moved = useRef(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (moved.current) box.current?.querySelector<SVGCircleElement>(`circle[data-index="${focus}"]`)?.focus()
    moved.current = false
  }, [focus])
  const onMove = (m: Move) => {
    moved.current = true
    setFocus((f) => Math.max(0, Math.min(rows.length - 1, m === "home" ? 0 : m === "end" ? rows.length - 1 : f + m)))
  }
  const peak = Math.max(...rows.map((r) => r.fitted)) * CHART_REFS.peakLine // ponytail: peaking line on the fitted scale, exact only when the observed range covers the peak
  const f = rows[focus]
  const table = (caption: string, series: Series[]) => ({ caption, columns: cols(series), rows })
  const share = (title: string, series: Series[], caption: string, extra?: React.ReactNode) => (
    <ChartPanel title={title} summary={summary} table={table(caption, series)}>
      <>
        <ChartContainer config={config(series)} className="h-56 w-full">
          <ComposedChart data={rows}>{axes}{lines(series)}{extra}</ComposedChart>
        </ChartContainer>
        <SeriesLegend series={series} />
      </>
    </ChartPanel>
  )
  return (
    <div className="space-y-8">
      <ChartPanel title="Search interest and fitted curve" summary={summary} table={{
        caption: "Weekly search interest, fitted curve and fitted stage",
        columns: [...cols(MAIN_SERIES), { key: "stage", label: "Fitted stage" }], rows: stagedRows,
      }}>
        <div ref={box}>
          <div aria-hidden="true" className="mb-1 font-mono text-xs tabular-nums text-lab-muted">
            {f.week} · interest {f.interest.toFixed(2)} · fitted {f.fitted.toFixed(2)}
          </div>
          <ChartContainer config={config(MAIN_SERIES)} className="h-72 w-full">
            <ComposedChart data={stagedRows}>
              {axes}
              <defs>
                {STAGES.map(({ key, token, pattern }) => <pattern key={key} id={`aura-${key}`} width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill={tok(token)} fillOpacity="0.18" />
                  {pattern === "dots" ? <circle cx="2" cy="2" r="1" fill={tok(token)} /> :
                    pattern === "cross" ? <path d="M0 0L8 8M8 0L0 8" stroke={tok(token)} strokeWidth="0.8" /> :
                    pattern === "horizontal" ? <path d="M0 2H8M0 6H8" stroke={tok(token)} strokeWidth="0.8" /> :
                    <path d="M-2 8L8 -2M2 10L10 2" stroke={tok(token)} strokeWidth="0.8" />}
                </pattern>)}
              </defs>
              {STAGES.map(({ key, token }) => <Area key={key} dataKey={`region_${key}`} type="monotone" stroke={tok(token)} strokeWidth={0} fill={`url(#aura-${key})`} connectNulls={false} isAnimationActive={false} />)}
              {win && <ReferenceArea x1={win.from} x2={win.to} fill={tok("text-muted")} fillOpacity={0.1} label={{ value: "Last 180 days", position: "insideBottomRight", fill: tok("text-muted"), fontSize: 12 }} />}
              {win && <ReferenceLine x={win.to} stroke={tok("border-strong")} label={{ value: "Now", position: "insideTopLeft", fill: tok("text-muted"), fontSize: 12 }} />}
              <ReferenceLine y={peak} stroke={tok("stage-peaking")} strokeDasharray="4 4" label={{ value: "Peaking line (80% of peak)", position: "insideTopRight", fill: tok("text-muted"), fontSize: 12 }} />
              <Line dataKey="interest" stroke="none" isAnimationActive={false} activeDot={false}
                dot={(p: { key?: string; cx?: number; cy?: number; index?: number; payload?: { week: string; interest: number; fitted: number } }) => (
                  <FocusDot key={p.index} cx={p.cx} cy={p.cy} index={p.index} payload={p.payload} tabbable={p.index === focus}
                    active={p.index === focus} onFocusPoint={setFocus} onMove={onMove} />
                )} />
              {lines([MAIN_SERIES[1]])}
            </ComposedChart>
          </ChartContainer>
          <SeriesLegend series={MAIN_SERIES} />
          <ul aria-label="Aura stage regions" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-lab-muted">
            {STAGES.map(({ key, token, pattern }) => <li key={key} className="flex items-center gap-1.5">
              <svg aria-hidden="true" width="16" height="12"><rect width="16" height="12" fill={tok(token)} fillOpacity="0.18" />
                {pattern === "dots" ? <circle cx="4" cy="4" r="1.5" fill={tok(token)} /> : <path d={pattern === "cross" ? "M0 0L8 8M8 0L0 8" : pattern === "horizontal" ? "M0 3H16M0 9H16" : "M0 12L12 0M6 12L16 2"} stroke={tok(token)} strokeWidth="1" />}</svg>
              {AURA_STAGE_LABELS[key]}
            </li>)}
          </ul>
        </div>
      </ChartPanel>
      {share("Population shares", SHARE_SERIES, "Susceptible, infected and recovered shares by week")}
      {share("Feedback Γ(t)", FEEDBACK_SERIES, "Feedback Γ(t) by week")}
    </div>
  )
}
