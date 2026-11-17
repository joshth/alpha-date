"use client"
import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Select, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ModelReports, ModelView, Ratio, SettingView } from "@/lib/eval/model-reports"
import {
  CompareAucChart, CompareCostChart, CompareH1RecallChart, CompareSpeedChart, RocChart, TemperatureChart, WordTypeChart, type CompareRow,
} from "./model-report-charts"

export const ALL = "all"

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`)
const of = (r: Ratio) => `${r.numerator} of ${r.denominator}`
const money = (v: number | null, local: boolean) => (v === null ? "unknown" : local && v === 0 ? "$0 (local)" : v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`)
const secs = (ms: number | null) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)} s`)

function status(s: SettingView): { text: string; variant: "default" | "destructive" | "secondary" } {
  if (!s.reliable) return { text: "Unreliable", variant: "destructive" }
  return s.acceptable ? { text: "Passes the rule", variant: "default" } : { text: "Fails the rule", variant: "secondary" }
}

function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-lab-border bg-lab-raised p-3" title={hint}>
      <p className="text-xs text-lab-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-lab-muted">{sub}</p>}
    </div>
  )
}

function Words({ title, words, empty }: { title: string; words: SettingView["madeUp"]; empty: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{title} <span className="text-lab-muted">· {words.length}</span></h3>
      {words.length === 0 ? <p className="text-sm text-lab-muted">{empty}</p> : (
        <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
          {words.map((w) => (
            <li key={w.word}><Badge variant="outline" className="font-mono font-normal">{w.word}{w.of > 1 && <span className="ml-1 text-lab-muted">{w.times}/{w.of}</span>}</Badge></li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function compareRows(models: ModelView[]): CompareRow[] {
  return models.map((m) => {
    const s = m.settings[m.bestIndex]
    return {
      id: m.id, label: m.label, temperature: s.temperature, recall: s.recall.value, h1: s.hallucination.value,
      auc: s.auc, cost: s.costPer1000Usd, latencyS: s.meanLatencyMs === null ? null : s.meanLatencyMs / 1000, reliable: s.reliable,
    }
  })
}

function ModelDetail({ model, rule }: { model: ModelView; rule: ModelReports["rule"] }) {
  const [index, setIndex] = useState(model.bestIndex)
  const s = model.settings[index] ?? model.settings[model.bestIndex]
  const st = status(s)
  const range = s.hallucinationRange && s.runs > 1 ? ` · repeats ${pct(s.hallucinationRange[0])}–${pct(s.hallucinationRange[1])}` : ""
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Temperature">
        <span className="text-sm text-lab-muted">Temperature</span>
        {model.settings.map((x, i) => (
          <button key={x.temperature} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}
            className={`rounded-md border px-2.5 py-1 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${i === index ? "border-lab-text bg-lab-control" : "border-lab-border hover:bg-lab-raised"}`}>
            {x.temperature}{i === model.bestIndex && <span className="ml-1 font-sans text-xs text-lab-muted">best</span>}
          </button>
        ))}
        {model.settings.length === 1 && model.id === "openai:gpt-6-astra" && <span className="text-xs text-lab-muted">GPT-6 Astra only accepts temperature 1.</span>}
      </div>

      <div role="status" className="flex flex-wrap items-start gap-2 rounded-lg border border-lab-border p-3 text-sm">
        <Badge variant={st.variant}>{st.text}</Badge>
        <span>{s.verdict}</span>
        {index === model.bestIndex && <span className="text-lab-muted">Shown first because it is the {model.bestReason}.</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Made-up words accepted (H1)" value={pct(s.hallucination.value)} sub={`${of(s.hallucination)}${range}`} hint={`Rule: at most ${pct(rule.maxH1)}`} />
        <Stat label="Real slang found (recall)" value={pct(s.recall.value)} sub={of(s.recall)} hint={`Rule: at least ${pct(rule.minRecall)}`} />
        <Stat label="Judgement (AUC)" value={s.auc === null ? "n/a" : s.auc.toFixed(2)} sub="1.00 perfect · 0.50 coin flip" />
        <Stat label="Precision" value={pct(s.precision.value)} sub={s.precision.denominator ? `${of(s.precision)} accepted were real` : "accepted nothing"} />
        <Stat label="Rated too safe" value={pct(s.mislabel.value)} sub={s.mislabel.denominator ? of(s.mislabel) : "no sensitive words accepted"} />
        <Stat label="Cost per 1,000 lookups" value={money(s.costPer1000Usd, !model.hosted)} sub={model.hosted ? "OpenAI list price, saved tokens" : "runs on the laptop"} />
        <Stat label="Average time per word" value={secs(s.meanLatencyMs)} />
        <Stat label="Failed calls" value={`${s.errors} of ${s.calls}`} sub={`${s.runs} repeat${s.runs === 1 ? "" : "s"} · limit ${pct(rule.maxErrorRate)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardContent className="pt-6"><TemperatureChart model={model} /></CardContent></Card>
        <Card><CardContent className="pt-6"><RocChart setting={s} label={model.label} /></CardContent></Card>
        <Card><CardContent className="pt-6"><WordTypeChart setting={s} /></CardContent></Card>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Words title="Made-up or ordinary words it accepted as slang" words={s.madeUp} empty="None: it never vouched for a made-up word." />
            <Words title="Real slang it missed" words={s.missed} empty="None: it found every real slang word." />
            {s.runs > 1 && <p className="text-xs text-lab-muted">n/{s.runs} = wrong in n of the {s.runs} repeats.</p>}
          </CardContent>
        </Card>
      </div>

      {model.recommendations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recommended by the harness</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {model.recommendations.map((r) => (
                <li key={r.title}><span className="font-medium">{r.title}</span> (temperature {r.setting.temperature}): <span className="text-lab-muted">{r.why}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SettingsTable model={model} selected={index} onSelect={setIndex} />
    </div>
  )
}

function SettingsTable({ model, selected, onSelect }: { model: ModelView; selected: number; onSelect: (i: number) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Every setting for {model.label}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr className="text-lab-muted"><th className="py-1">Temperature</th><th>H1</th><th>Recall</th><th>AUC</th><th>Rated too safe</th><th>Failed calls</th><th>Time</th><th>Result</th></tr></thead>
          <tbody>
            {model.settings.map((s, i) => (
              <tr key={s.temperature} className={`border-t border-lab-border ${i === selected ? "bg-lab-raised" : ""}`}>
                <td className="py-1"><button type="button" className="font-mono underline-offset-2 hover:underline" onClick={() => onSelect(i)}>{s.temperature}</button></td>
                <td className="font-mono tabular-nums">{pct(s.hallucination.value)}</td>
                <td className="font-mono tabular-nums">{pct(s.recall.value)}</td>
                <td className="font-mono tabular-nums">{s.auc === null ? "n/a" : s.auc.toFixed(2)}</td>
                <td className="font-mono tabular-nums">{pct(s.mislabel.value)}</td>
                <td className="font-mono tabular-nums">{s.errors}/{s.calls}{s.reliable ? "" : " ⚠"}</td>
                <td className="font-mono tabular-nums">{secs(s.meanLatencyMs)}</td>
                <td><Badge variant={status(s).variant}>{status(s).text}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function CompareAll({ reports, onPick }: { reports: ModelReports; onPick: (id: string) => void }) {
  const rows = compareRows(reports.models)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">What the harness recommends</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2">
            {reports.recommendations.map((r) => (
              <li key={r.title} className="rounded-lg border border-lab-border p-3 text-sm">
                <p className="font-medium">{r.title}</p>
                <button type="button" className="font-mono text-sm text-lab-text underline-offset-2 hover:underline" onClick={() => onPick(r.setting.model)}>
                  {reports.models.find((m) => m.id === r.setting.model)?.label ?? r.setting.model} @ {r.setting.temperature}
                </button>
                <p className="mt-1 text-lab-muted">{r.why}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card><CardContent className="pt-6"><CompareH1RecallChart rows={rows} /></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardContent className="pt-6"><CompareAucChart rows={rows} /></CardContent></Card>
        <Card><CardContent className="pt-6"><CompareCostChart rows={rows} /></CardContent></Card>
        <Card><CardContent className="pt-6"><CompareSpeedChart rows={rows} /></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Each model at its best setting</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="text-lab-muted"><th className="py-1">Model</th><th>Temp.</th><th>H1</th><th>Recall</th><th>AUC</th><th>Cost / 1,000</th><th>Time</th><th>Result</th></tr></thead>
            <tbody>
              {reports.models.map((m) => {
                const s = m.settings[m.bestIndex]
                return (
                  <tr key={m.id} className="border-t border-lab-border">
                    <td className="py-1"><button type="button" className="underline-offset-2 hover:underline" onClick={() => onPick(m.id)}>{m.label}</button></td>
                    <td className="font-mono tabular-nums">{s.temperature}</td>
                    <td className="font-mono tabular-nums">{pct(s.hallucination.value)}</td>
                    <td className="font-mono tabular-nums">{pct(s.recall.value)}</td>
                    <td className="font-mono tabular-nums">{s.auc === null ? "n/a" : s.auc.toFixed(2)}</td>
                    <td className="font-mono tabular-nums">{money(s.costPer1000Usd, !m.hosted)}</td>
                    <td className="font-mono tabular-nums">{secs(s.meanLatencyMs)}</td>
                    <td><Badge variant={status(s).variant}>{status(s).text}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export function ModelReportsPanel({ reports, initialModel }: { reports: ModelReports; initialModel?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const valid = (id?: string) => id === ALL || reports.models.some((m) => m.id === id)
  const [selected, setSelected] = useState(valid(initialModel) ? initialModel! : ALL)
  const pick = (id: string) => {
    setSelected(id)
    router.replace(id === ALL ? pathname : `${pathname}?model=${encodeURIComponent(id)}`, { scroll: false })
  }
  const model = reports.models.find((m) => m.id === selected)
  const date = new Date(reports.startedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Perth" })
  const words = reports.models[0]?.settings[0]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold">Model reports</h1>
          <p className="text-sm text-lab-muted">
            Which AI should decode slang? {reports.models.length} models tested on the same answer key, from the saved sweep report.
          </p>
        </div>
        <div className="w-64 space-y-1">
          <label id="model-select-label" className="text-xs text-lab-muted">Model</label>
          <Select value={selected} onValueChange={pick}>
            <SelectTrigger aria-labelledby="model-select-label" className="bg-lab-input"><SelectValue /></SelectTrigger>
            {/* No portal: the menu stays inside .lab, so it gets the Lab theme and fonts. */}
            <SelectPrimitive.Content position="popper" sideOffset={4}
              className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-lab-border bg-lab-raised text-lab-text shadow-md">
              <SelectPrimitive.Viewport className="w-full min-w-[var(--radix-select-trigger-width)] p-1">
              <SelectItem value={ALL}>All {reports.models.length} models (compare)</SelectItem>
              <SelectSeparator />
              {reports.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.label}<span className="ml-2 text-xs text-lab-muted">{m.hosted ? "OpenAI" : "local"}</span></SelectItem>
              ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </Select>
        </div>
      </div>

      <p className="text-xs text-lab-muted">
        Saved report {date} (Perth) · {reports.split} split{words ? `, ${words.calls / words.runs} words × ${words.runs} repeats per setting` : ""} · answer key v{reports.datasetVersion} · prompt {reports.promptVersion}
        {reports.mock && " · MOCK model"} · rule: H1 ≤ {pct(reports.rule.maxH1)}, recall ≥ {pct(reports.rule.minRecall)}, failed calls ≤ {pct(reports.rule.maxErrorRate)} ·{" "}
        <span className="font-mono text-xs" title={`eval/reports/${reports.file}`}>{reports.file.split("-sweep-")[0]} combined report</span>
      </p>

      {model ? <ModelDetail key={model.id} model={model} rule={reports.rule} /> : <CompareAll reports={reports} onPick={pick} />}
    </div>
  )
}
