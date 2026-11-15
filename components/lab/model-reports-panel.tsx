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

