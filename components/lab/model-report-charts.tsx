"use client"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { ChartPanel } from "@/components/aura/chart-panel"
import type { ModelView, SettingView } from "@/lib/eval/model-reports"

// Charts for the Lab's Model reports page. Every chart has a table view
// (ChartPanel) and a hover tooltip; percentages share one 0–100% axis.

const tok = (n: string) => `hsl(var(--lab-${n}))`
export const COLORS = { recall: tok("primary"), h1: tok("stage-peaking"), auc: tok("stage-declining"), cost: tok("stage-parent-territory") }
const tick = { fill: tok("text-muted"), fontSize: 12 }
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 100)}%`)
const pctAxis = (v: number) => `${Math.round(v * 100)}%`

type TipRow = { name: string; value: string; color?: string }
function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-md border border-lab-border bg-lab-raised px-3 py-2 text-xs shadow">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2">
          {r.color && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-lab-muted">{r.name}</span>
          <span className="ml-auto font-mono tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-lab-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-3 rounded-sm" style={{ background: i.color }} />{i.label}
        </li>
      ))}
    </ul>
  )
}

const h1Recall: ChartConfig = { recall: { label: "Real slang found (recall)", color: COLORS.recall }, h1: { label: "Made-up words accepted (H1)", color: COLORS.h1 } }

export function TemperatureChart({ model }: { model: ModelView }) {
  const data = model.settings.map((s) => ({ temperature: s.temperature, recall: s.recall.value, h1: s.hallucination.value, reliable: s.reliable }))
  const one = data.length === 1
  const summary = one
    ? `${model.label} runs only at temperature ${data[0].temperature}: recall ${pct(data[0].recall)}, H1 ${pct(data[0].h1)}.`
    : `Across temperatures ${data.map((d) => d.temperature).join(", ")}, recall ranges ${pct(Math.min(...data.map((d) => d.recall ?? 0)))}–${pct(Math.max(...data.map((d) => d.recall ?? 0)))} and H1 ${pct(Math.min(...data.map((d) => d.h1 ?? 0)))}–${pct(Math.max(...data.map((d) => d.h1 ?? 0)))}.`
  return (
    <ChartPanel title="Temperature: real slang found vs made-up words accepted" summary={summary}
      table={{ caption: "Recall and H1 by temperature", columns: [{ key: "temperature", label: "Temperature", numeric: true }, { key: "recall", label: "Recall" }, { key: "h1", label: "H1" }, { key: "reliable", label: "Reliable" }],
        rows: data.map((d) => ({ temperature: d.temperature, recall: pct(d.recall), h1: pct(d.h1), reliable: d.reliable ? "yes" : "no" })) }}>
      <Legend items={[{ label: "Real slang found (recall), higher is better", color: COLORS.recall }, { label: "Made-up words accepted (H1), lower is better", color: COLORS.h1 }]} />
      <ChartContainer config={h1Recall} className="aspect-auto h-60 w-full">
        <LineChart data={data} margin={{ top: 12, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={tok("border")} />
          <XAxis dataKey="temperature" type="number" domain={one ? [data[0].temperature - 0.5, data[0].temperature + 0.5] : ["dataMin", "dataMax"]} ticks={data.map((d) => d.temperature)}
            tickLine={false} tick={tick} stroke={tok("border-strong")} padding={{ left: 16, right: 16 }} label={{ value: "Temperature", position: "insideBottomRight", offset: -2, fill: tok("text-muted"), fontSize: 11 }} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pctAxis} width={44} tickLine={false} tick={tick} stroke={tok("border-strong")} />
          <ChartTooltip cursor={{ stroke: tok("border-strong") }} content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload as (typeof data)[number] | undefined
            return p ? <Tip title={`Temperature ${p.temperature}${p.reliable ? "" : " (unreliable)"}`} rows={[{ name: "Recall", value: pct(p.recall), color: COLORS.recall }, { name: "H1", value: pct(p.h1), color: COLORS.h1 }]} /> : null
          }} />
          <Line dataKey="recall" stroke={COLORS.recall} strokeWidth={2} dot={{ r: 5, fill: COLORS.recall, strokeWidth: 0 }} activeDot={{ r: 7 }} isAnimationActive={false} />
          <Line dataKey="h1" stroke={COLORS.h1} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 5, fill: COLORS.h1, strokeWidth: 0 }} activeDot={{ r: 7 }} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    </ChartPanel>
  )
}

export function RocChart({ setting, label }: { setting: SettingView; label: string }) {
  const data = setting.roc
  const summary = setting.auc === null
    ? "No ROC curve: this setting had no answered real and non-real words to compare."
    : `AUC ${setting.auc.toFixed(2)}: ${setting.auc >= 0.9 ? "very good" : setting.auc >= 0.75 ? "good" : setting.auc > 0.55 ? "weak" : "no better than a coin flip"} at telling real slang from made-up and ordinary words (1.00 is perfect, 0.50 is a coin flip).`
  return (
    <ChartPanel title={`ROC curve, ${label} at temperature ${setting.temperature}`} summary={summary}
      table={{ caption: "ROC points", columns: [{ key: "fpr", label: "False accept rate", numeric: true }, { key: "tpr", label: "Recall", numeric: true }], rows: data.map((p) => ({ fpr: p.fpr, tpr: p.tpr })) }}>
      <Legend items={[{ label: `This setting (AUC ${setting.auc === null ? "n/a" : setting.auc.toFixed(2)})`, color: COLORS.recall }, { label: "Coin flip (AUC 0.50)", color: tok("border-strong") }]} />
      <ChartContainer config={{ tpr: { label: "Recall", color: COLORS.recall } }} className="aspect-auto h-60 w-full">
        <LineChart data={data} margin={{ top: 12, right: 24, left: 4, bottom: 12 }}>
          <CartesianGrid stroke={tok("border")} />
          <XAxis dataKey="fpr" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pctAxis} tickLine={false} tick={tick} stroke={tok("border-strong")}
            label={{ value: "Non-slang wrongly accepted", position: "insideBottom", offset: -8, fill: tok("text-muted"), fontSize: 11 }} />
          <YAxis dataKey="tpr" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pctAxis} width={44} tickLine={false} tick={tick} stroke={tok("border-strong")} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={tok("border-strong")} strokeDasharray="4 4" ifOverflow="extendDomain" />
          <ChartTooltip cursor={false} content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload as (typeof data)[number] | undefined
            return p ? <Tip title="ROC point" rows={[{ name: "Real slang found", value: pct(p.tpr), color: COLORS.recall }, { name: "Non-slang accepted", value: pct(p.fpr) }]} /> : null
          }} />
          <Line dataKey="tpr" type="linear" stroke={COLORS.recall} strokeWidth={2} dot={{ r: 4, fill: COLORS.recall, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    </ChartPanel>
  )
}

export function WordTypeChart({ setting }: { setting: SettingView }) {
  const data = setting.wordTypes.map((w) => ({ ...w, value: w.share ?? 0 }))
  const real = data.filter((d) => d.real)
  const fake = data.filter((d) => !d.real)
  const avg = (xs: typeof data) => xs.reduce((s, x) => s + x.accepted, 0) / Math.max(1, xs.reduce((s, x) => s + x.answered, 0))
  return (
    <ChartPanel title="Which words it accepted as real slang" summary={`Accepted ${pct(avg(real))} of real-slang word types and ${pct(avg(fake))} of made-up word types, over every repeat at this temperature. Grouped by word type, so it can differ a little from H1 and recall, which use the answer key's categories.`}
      table={{ caption: "Share accepted by word type", columns: [{ key: "label", label: "Word type" }, { key: "accepted", label: "Accepted", numeric: true }, { key: "answered", label: "Answered", numeric: true }, { key: "share", label: "Share" }],
        rows: data.map((d) => ({ label: d.label, accepted: d.accepted, answered: d.answered, share: pct(d.share) })) }}>
      <Legend items={[{ label: "Real slang: should be high", color: COLORS.recall }, { label: "Made up: should be 0%", color: COLORS.h1 }]} />
      <ChartContainer config={{ value: { label: "Accepted", color: COLORS.recall } }} className="aspect-auto h-60 w-full">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={tok("border")} />
          <XAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pctAxis} tickLine={false} tick={tick} stroke={tok("border-strong")} />
          <YAxis type="category" dataKey="label" width={150} tickLine={false} tick={tick} stroke={tok("border-strong")} />
          <ChartTooltip cursor={{ fill: tok("surface-raised") }} content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload as (typeof data)[number] | undefined
            return p ? <Tip title={p.label} rows={[{ name: "Accepted", value: `${p.accepted} of ${p.answered} (${pct(p.share)})`, color: p.real ? COLORS.recall : COLORS.h1 }]} /> : null
          }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} minPointSize={2}>
            {data.map((d) => <Cell key={d.wordType} fill={d.real ? COLORS.recall : COLORS.h1} />)}
            <LabelList dataKey="value" position="right" formatter={pctAxis} fill={tok("text")} fontSize={12} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  )
}

export interface CompareRow { id: string; label: string; temperature: number; recall: number | null; h1: number | null; auc: number | null; cost: number | null; latencyS: number | null; reliable: boolean }

export function CompareH1RecallChart({ rows }: { rows: CompareRow[] }) {
  const data = rows.map((r) => ({ ...r, recallV: r.recall ?? 0, h1V: r.h1 ?? 0 }))
  const reliable = rows.filter((r) => r.reliable)
  const top = [...reliable].sort((a, b) => (b.recall ?? 0) - (a.recall ?? 0))[0]
  const worst = [...reliable].sort((a, b) => (b.h1 ?? 0) - (a.h1 ?? 0))[0]
  const clean = reliable.filter((r) => r.h1 === 0).map((r) => r.label)
  const summary = !top ? "No reliable model." : [
    `${top.label} finds the most real slang (${pct(top.recall)}).`,
    clean.length ? `${clean.join(", ")} accepted no made-up words.` : "",
    worst && (worst.h1 ?? 0) > 0 ? `${worst.label} accepted the most (${pct(worst.h1)}).` : "",
  ].filter(Boolean).join(" ")
  return (
    <ChartPanel title="Each model at its best setting: real slang found vs made-up words accepted" summary={summary}
      table={{ caption: "Recall and H1 per model", columns: [{ key: "label", label: "Model" }, { key: "temperature", label: "Temperature", numeric: true }, { key: "recall", label: "Recall" }, { key: "h1", label: "H1" }, { key: "reliable", label: "Reliable" }],
        rows: rows.map((r) => ({ label: r.label, temperature: r.temperature, recall: pct(r.recall), h1: pct(r.h1), reliable: r.reliable ? "yes" : "no" })) }}>
      <Legend items={[{ label: "Real slang found (recall), higher is better", color: COLORS.recall }, { label: "Made-up words accepted (H1), lower is better", color: COLORS.h1 }]} />
      <ChartContainer config={h1Recall} className="aspect-auto h-72 w-full">
        <BarChart data={data} margin={{ top: 20, right: 8, left: 4, bottom: 4 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={tok("border")} />
          <XAxis dataKey="label" tickLine={false} tick={tick} stroke={tok("border-strong")} interval={0} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pctAxis} width={44} tickLine={false} tick={tick} stroke={tok("border-strong")} />
          <ChartTooltip cursor={{ fill: tok("surface-raised") }} content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload as (typeof data)[number] | undefined
            return p ? <Tip title={`${p.label} @ ${p.temperature}${p.reliable ? "" : " (unreliable)"}`} rows={[{ name: "Recall", value: pct(p.recall), color: COLORS.recall }, { name: "H1", value: pct(p.h1), color: COLORS.h1 }]} /> : null
          }} />
          <Bar dataKey="recallV" fill={COLORS.recall} radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={2}>
            <LabelList dataKey="recallV" position="top" formatter={pctAxis} fill={tok("text")} fontSize={11} />
          </Bar>
          <Bar dataKey="h1V" fill={COLORS.h1} radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={2}>
            <LabelList dataKey="h1V" position="top" formatter={pctAxis} fill={tok("text-muted")} fontSize={11} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  )
}

function SingleBarChart({ title, summary, rows, value, format, color, caption, column }: {
  title: string; summary: string; rows: CompareRow[]; value: (r: CompareRow) => number | null
  format: (v: number) => string; color: string; caption: string; column: string
}) {
  const data = rows.map((r) => ({ label: r.label, v: value(r) ?? 0, known: value(r) !== null, reliable: r.reliable }))
  return (
    <ChartPanel title={title} summary={summary}
      table={{ caption, columns: [{ key: "label", label: "Model" }, { key: "v", label: column }], rows: data.map((d) => ({ label: d.label, v: d.known ? format(d.v) : "n/a" })) }}>
      <ChartContainer config={{ v: { label: column, color } }} className="aspect-auto h-60 w-full">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={tok("border")} />
          <XAxis type="number" tickFormatter={format} tickLine={false} tick={tick} stroke={tok("border-strong")} />
          <YAxis type="category" dataKey="label" width={120} tickLine={false} tick={tick} stroke={tok("border-strong")} />
          <ChartTooltip cursor={{ fill: tok("surface-raised") }} content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload as (typeof data)[number] | undefined
            return p ? <Tip title={`${p.label}${p.reliable ? "" : " (unreliable)"}`} rows={[{ name: column, value: p.known ? format(p.v) : "n/a", color }]} /> : null
          }} />
          <Bar dataKey="v" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} minPointSize={2}>
            <LabelList dataKey="v" position="right" formatter={format} fill={tok("text")} fontSize={12} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  )
}

export function CompareAucChart({ rows }: { rows: CompareRow[] }) {
  const best = [...rows].filter((r) => r.reliable).sort((a, b) => (b.auc ?? 0) - (a.auc ?? 0))[0]
  return <SingleBarChart title="Judgement: AUC per model (1.00 perfect, 0.50 coin flip)" rows={rows} value={(r) => r.auc} format={(v) => v.toFixed(2)} color={COLORS.auc}
    caption="AUC per model" column="AUC" summary={best ? `${best.label} separates real slang from everything else best (AUC ${best.auc?.toFixed(2)}).` : "No reliable model."} />
}

export function CompareCostChart({ rows }: { rows: CompareRow[] }) {
  const paid = rows.filter((r) => (r.cost ?? 0) > 0).sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
  const summary = paid.length >= 2
    ? `Local models cost nothing per call. Of the hosted models, ${paid[0].label} is cheapest ($${paid[0].cost?.toFixed(3)}) and ${paid.at(-1)!.label} costs about ${Math.round((paid.at(-1)!.cost ?? 0) / (paid[0].cost ?? 1))}× more.`
    : "Cost per 1,000 lookups from the saved token counts."
  return <SingleBarChart title="Cost per 1,000 lookups (USD)" rows={rows} value={(r) => r.cost} format={(v) => (v === 0 ? "$0" : v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`)} color={COLORS.cost}
    caption="Cost per 1,000 lookups" column="Cost per 1,000" summary={summary} />
}

export function CompareSpeedChart({ rows }: { rows: CompareRow[] }) {
  const fastest = [...rows].filter((r) => r.reliable && r.latencyS !== null).sort((a, b) => (a.latencyS ?? 0) - (b.latencyS ?? 0))[0]
  return <SingleBarChart title="Average time per word (seconds)" rows={rows} value={(r) => r.latencyS} format={(v) => `${v.toFixed(1)} s`} color={tok("text-muted")}
    caption="Average seconds per word" column="Seconds" summary={fastest ? `${fastest.label} is fastest at ${fastest.latencyS?.toFixed(1)} s per word. Local models ran on an 8 GB Mac.` : "No timing."} />
}
