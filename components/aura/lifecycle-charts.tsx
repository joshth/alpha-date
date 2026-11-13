"use client"
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ChartPanel } from "./chart-panel"
import type { SirsFit } from "@/lib/aura/fit-command"
import { lifecycleRows, trendSentence } from "@/lib/aura/trend-text"

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
const axes = (
  <>
    <CartesianGrid vertical={false} stroke={tok("border")} />
    <XAxis dataKey="week" tickLine={false} minTickGap={48} />
    <YAxis width={40} tickLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
  </>
)
const lines = (series: Series[]) => series.map((s) => (
  <Line key={s.key} dataKey={s.key} type="monotone" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} dot={false} isAnimationActive={false} />
))
const cols = (series: Series[]) => [{ key: "week", label: "Week" }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))]

export function LifecycleCharts({ fit }: { fit: SirsFit }) {
  const rows = useMemo(() => lifecycleRows(fit), [fit])
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
      <ChartContainer config={config(series)} className="h-56 w-full">
        <ComposedChart data={rows}>{axes}{lines(series)}{extra}</ComposedChart>
      </ChartContainer>
    </ChartPanel>
  )
  return (
    <div className="space-y-8">
      <ChartPanel title="Search interest and fitted curve" summary={summary} table={table("Weekly search interest and fitted curve", MAIN_SERIES)}>
        <div ref={box}>
          <div aria-hidden="true" className="mb-1 font-mono text-xs tabular-nums text-lab-muted">
            {f.week} · interest {f.interest.toFixed(2)} · fitted {f.fitted.toFixed(2)}
          </div>
          <ChartContainer config={config(MAIN_SERIES)} className="h-72 w-full">
            <ComposedChart data={rows}>
              {axes}
              <ReferenceArea x1={fit.windowStart} x2={fit.now} fill={tok("text-muted")} fillOpacity={0.1} label="Last 180 days" />
              <ReferenceLine x={fit.now} stroke={tok("border-strong")} label="Now" />
              <ReferenceLine y={peak} stroke={tok("stage-peaking")} strokeDasharray="4 4" label="Peaking line (80% of peak)" />
              <Line dataKey="interest" stroke="none" isAnimationActive={false} activeDot={false}
                dot={(p: { key?: string; cx?: number; cy?: number; index?: number; payload?: { week: string; interest: number; fitted: number } }) => (
                  <FocusDot key={p.index} cx={p.cx} cy={p.cy} index={p.index} payload={p.payload} tabbable={p.index === focus}
                    active={p.index === focus} onFocusPoint={setFocus} onMove={onMove} />
                )} />
              {lines([MAIN_SERIES[1]])}
            </ComposedChart>
          </ChartContainer>
        </div>
      </ChartPanel>
      {share("Population shares", SHARE_SERIES, "Susceptible, infected and recovered shares by week")}
      {share("Feedback Γ(t)", FEEDBACK_SERIES, "Feedback Γ(t) by week")}
    </div>
  )
}
