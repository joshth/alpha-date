import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { type CostSummary, formatUsd, type RunTiming } from "@/lib/eval/cost"
import type { DiscoveryEvaluation } from "@/lib/eval/discovery"
import { formatRate, type Rate, rate } from "@/lib/eval/metrics"
import { rocSvg } from "@/lib/eval/roc-chart"
import type { RunConfig } from "@/lib/eval/report"

// `pnpm eval --sweep --models llama3.2:1b,llama3.2:3b --temperatures 0,0.7,1.3 --repeats 3`.
//
// Every model × temperature pair is run `repeats` times over the same golden
// set. Rates are pooled over the repeats (numerators and denominators summed),
// and the per-run range of H1 is kept beside it to show run-to-run wobble.
// Repeats re-ask the same words, so the pooled interval treats them as separate
// draws and is narrower than a new set of words would give; the report says so.
// With LLM_SEED set, repeat r uses seed LLM_SEED + r: reproducible, but not the
// same sample twice.
//
// The decision rule is fixed before any real run:
// acceptable = H1 ≤ maxH1 and recall ≥ minRecall, and no more than
// maxErrorRate of its calls failed; recommend the cheapest acceptable setting
// per 1,000 calls, then the fastest. The error limit matters because errors are
// left out of every rate: a setting that answered 24 of 128 calls can show 0%
// H1 on almost no evidence (gpt-4o-mini over a slow VPN, 14 Nov 2026).

export const DEFAULT_TEMPERATURES = [0, 0.7, 1.3]
export const DEFAULT_REPEATS = 3
export const DEFAULT_MAX_H1 = 0.1
export const DEFAULT_MIN_RECALL = 0.5
export const DEFAULT_MAX_ERROR_RATE = 0.1

export interface SweepRule {
  maxH1: number
  minRecall: number
  maxErrorRate?: number
}

export interface SweepSetting {
  model: string
  temperature: number
}

export interface SweepOptions {
  models: string[]
  temperatures: number[]
  repeats: number
  maxH1: number
  minRecall: number
  maxErrorRate: number
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name)
  return at >= 0 ? argv[at + 1] : undefined
}

function numberFlag(argv: readonly string[], name: string, fallback: number, check: (n: number) => boolean, rule: string) {
  const raw = flagValue(argv, name)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!check(value)) throw new Error(`${name} must be ${rule} (got "${raw}")`)
  return value
}

// `openai:gpt-4o-mini` runs on OpenAI with OPENAI_API_KEY; any other name runs
// on LLM_BASE_URL (e.g. Ollama), so one sweep can compare local and hosted models.
export const OPENAI_PREFIX = "openai:"

export function modelRoute(model: string): { hosted: boolean; model: string } {
  return model.startsWith(OPENAI_PREFIX)
    ? { hosted: true, model: model.slice(OPENAI_PREFIX.length) }
    : { hosted: false, model }
}

export function parseSweepArgs(
  argv: readonly string[],
  currentModel: string,
  env: Record<string, string | undefined> = process.env,
): SweepOptions {
  const models = (flagValue(argv, "--models") ?? currentModel)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
  if (env.MOCK_LLM === "false") {
    const hosted = models.filter((m) => modelRoute(m).hosted)
    if (hosted.length > 0 && !env.OPENAI_API_KEY?.trim()) {
      throw new Error(`${hosted.join(", ")} need OPENAI_API_KEY: export it in this terminal first (pnpm eval does not read .env.local; never commit a key)`)
    }
    if (hosted.length > 0 && hosted.length < models.length && !env.LLM_BASE_URL?.trim()) {
      throw new Error("Mixing openai: models with local ones needs LLM_BASE_URL for the local ones, e.g. http://localhost:11434/v1")
    }
    if (hosted.some((m) => !modelRoute(m).model)) throw new Error(`"${OPENAI_PREFIX}" needs a model name, e.g. openai:gpt-4o-mini`)
  }
  const rawTemps = flagValue(argv, "--temperatures")
  const temperatures = rawTemps === undefined ? DEFAULT_TEMPERATURES : rawTemps.split(",").map((t) => Number(t.trim()))
  if (temperatures.length === 0 || temperatures.some((t) => !Number.isFinite(t) || t < 0 || t > 2)) {
    throw new Error(`--temperatures must be numbers from 0 to 2, comma-separated (got "${rawTemps}")`)
  }
  if (models.length === 0) throw new Error("--models needs at least one model name")
  const between = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1
  return {
    models,
    temperatures,
    repeats: numberFlag(argv, "--repeats", DEFAULT_REPEATS, (n) => Number.isInteger(n) && n >= 1, "a whole number ≥ 1"),
    maxH1: numberFlag(argv, "--max-h1", DEFAULT_MAX_H1, between, "a fraction from 0 to 1"),
    minRecall: numberFlag(argv, "--min-recall", DEFAULT_MIN_RECALL, between, "a fraction from 0 to 1"),
    maxErrorRate: numberFlag(argv, "--max-error-rate", DEFAULT_MAX_ERROR_RATE, between, "a fraction from 0 to 1"),
  }
}

export function sweepSettings(options: Pick<SweepOptions, "models" | "temperatures">): SweepSetting[] {
  return options.models.flatMap((model) => options.temperatures.map((temperature) => ({ model, temperature })))
}

const SWEPT_KEYS = ["LLM_MODEL", "LLM_TEMPERATURE", "LLM_SEED", "LLM_BASE_URL"] as const

// Runs `fn` with discovery switched to one setting, then puts the environment back.
export async function withDiscoverySetting<T>(setting: SweepSetting, repeat: number, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(SWEPT_KEYS.map((key) => [key, process.env[key]]))
  const baseSeed = process.env.LLM_SEED?.trim()
  const route = modelRoute(setting.model)
  // Hosted models skip LLM_BASE_URL so they go to OpenAI, not the local server.
  if (route.hosted) delete process.env.LLM_BASE_URL
  process.env.LLM_MODEL = route.model
  process.env.LLM_TEMPERATURE = String(setting.temperature)
  if (baseSeed && Number.isInteger(Number(baseSeed))) process.env.LLM_SEED = String(Number(baseSeed) + repeat)
  try {
    return await fn()
  } finally {
    for (const key of SWEPT_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

export interface SweepRun {
  setting: SweepSetting
  repeat: number
  config: RunConfig
  discovery: DiscoveryEvaluation
  cost: CostSummary
  timing: RunTiming
}

export interface SweepRow {
  setting: SweepSetting
  runs: number
  hallucinationRate: Rate
  hallucinationRange: [number, number] | null
  precision: Rate
  recall: Rate
  falseAcceptRate: Rate
  sensitivityMislabelRate: Rate
  errors: number
  // Calls made (answered + errors). `reliable` = errors ≤ maxErrorRate of them;
  // an unreliable row is shown but never recommended.
  calls: number
  reliable: boolean
  costPer1000CallsUsd: number | null
  meanLatencyMs: number | null
  acceptable: boolean
  // How well "how often it accepted the word" separates real slang from
  // everything else: 1 = perfectly, 0.5 = no better than a coin flip.
  auc: number | null
  roc: RocPoint[]
}

export interface RocPoint {
  fpr: number
  tpr: number
  // Accepted in at least this share of repeats; null for the (0, 0) start.
  threshold: number | null
}

// Each word's score is the share of its answered repeats that accepted it.
// Errors are skipped, as everywhere else. With one repeat (or temperature 0,
// where repeats agree) every score is 0 or 1, and AUC is balanced accuracy.
export function acceptanceScores(runs: readonly SweepRun[]): { score: number; positive: boolean }[] {
  const byId = new Map<string, { yes: number; answered: number; positive: boolean }>()
  for (const run of runs) {
    for (const r of run.discovery.results) {
      if (r.accepted === null) continue
      const entry = byId.get(r.id) ?? { yes: 0, answered: 0, positive: r.isRealSlang }
      entry.answered++
      if (r.accepted) entry.yes++
      byId.set(r.id, entry)
    }
  }
  return [...byId.values()].map((e) => ({ score: e.yes / e.answered, positive: e.positive }))
}

// ROC points from the highest threshold down, and the area under them
// (trapezoids, so a tie counts half: the same as the Mann-Whitney AUC).
export function rocCurve(scores: readonly { score: number; positive: boolean }[]): { auc: number | null; points: RocPoint[] } {
  const positives = scores.filter((s) => s.positive).length
  const negatives = scores.length - positives
  if (positives === 0 || negatives === 0) return { auc: null, points: [] }
  const points: RocPoint[] = [{ fpr: 0, tpr: 0, threshold: null }]
  for (const threshold of [...new Set(scores.map((s) => s.score))].sort((a, b) => b - a)) {
    const above = scores.filter((s) => s.score >= threshold)
    points.push({
      fpr: above.filter((s) => !s.positive).length / negatives,
      tpr: above.filter((s) => s.positive).length / positives,
      threshold,
    })
  }
  let auc = 0
  for (let i = 1; i < points.length; i++) auc += ((points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr)) / 2
  return { auc, points }
}

export interface SweepSummary {
  rule: Required<SweepRule>
  rows: SweepRow[]
  recommended: SweepRow | null
  closest: SweepRow | null
  recommendations: Recommendation[]
}

// Business recommendations for the client: each names one setting and gives
// the numbers behind it. The same setting can win more than one.
export interface Recommendation {
  title: string
  setting: SweepSetting
  why: string
}

const pctOf = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`)
const name = (s: SweepSetting) => `${s.model} @ temperature ${s.temperature}`

export function recommend(allRows: readonly SweepRow[], rule: SweepRule): Recommendation[] {
  const out: Recommendation[] = []
  // Rows with too many errors rest on too few answers to recommend or warn about.
  const rows = allRows.filter((r) => r.reliable)
  const acceptable = rows.filter((r) => r.acceptable)
  const passRule = `H1 ${pctOf(rule.maxH1)} or less and recall ${pctOf(rule.minRecall)} or more`

  const budget = [...acceptable].sort(
    (a, b) => orUnknown(a.costPer1000CallsUsd) - orUnknown(b.costPer1000CallsUsd) || orUnknown(a.meanLatencyMs) - orUnknown(b.meanLatencyMs),
  )[0]
  if (budget) {
    out.push({
      title: "Budget pick",
      setting: budget.setting,
      why:
        `cheapest of the ${acceptable.length} setting(s) that pass the rule (${passRule}): ` +
        `${formatUsd(budget.costPer1000CallsUsd)} per 1,000 calls, H1 ${pctOf(budget.hallucinationRate.value)}, recall ${pctOf(budget.recall.value)}.`,
    })
  }

  // Fewest made-up words, but only among settings that still find real slang:
  // 0% H1 is easy if the model says "not slang" to everything.
  const useful = rows.filter((r) => r.recall.value !== null && r.recall.value >= rule.minRecall && r.hallucinationRate.value !== null)
  const safest = [...useful].sort(
    (a, b) =>
      (a.hallucinationRate.value ?? 1) - (b.hallucinationRate.value ?? 1) ||
      (b.recall.value ?? 0) - (a.recall.value ?? 0) ||
      orUnknown(a.costPer1000CallsUsd) - orUnknown(b.costPer1000CallsUsd),
  )[0]
  if (safest) {
    out.push({
      title: "Safest pick (fewest made-up meanings)",
      setting: safest.setting,
      why:
        `lowest H1 (${pctOf(safest.hallucinationRate.value)}) of the settings that still find at least ${pctOf(rule.minRecall)} of real slang ` +
        `(recall ${pctOf(safest.recall.value)}).`,
    })
  } else {
    out.push({
      title: "Safest pick (fewest made-up meanings)",
      setting: [...rows].sort((a, b) => (a.hallucinationRate.value ?? 1) - (b.hallucinationRate.value ?? 1))[0]?.setting ?? { model: "none", temperature: 0 },
      why: `no setting finds ${pctOf(rule.minRecall)} of real slang, so a low H1 here may only mean the model rejects most words.`,
    })
  }

  const judged = rows.filter((r) => r.auc !== null)
  const sharpest = [...judged].sort((a, b) => (b.auc ?? 0) - (a.auc ?? 0))[0]
  if (sharpest && (sharpest.auc ?? 0) <= 0.55) {
    out.push({
      title: "Best judgement (highest AUC)",
      setting: sharpest.setting,
      why: `none: the best AUC is ${sharpest.auc!.toFixed(2)}, no better than a coin flip (0.50) at telling real slang from everything else.`,
    })
  } else if (sharpest) {
    out.push({
      title: "Best judgement (highest AUC)",
      setting: sharpest.setting,
      why:
        `AUC ${sharpest.auc!.toFixed(2)}: best at telling real slang from made-up and ordinary words ` +
        `(1.00 is perfect, 0.50 is a coin flip).`,
    })
  }

  const fastest = [...acceptable].sort((a, b) => orUnknown(a.meanLatencyMs) - orUnknown(b.meanLatencyMs))[0]
  if (fastest && fastest.meanLatencyMs !== null) {
    out.push({
      title: "Fastest pick",
      setting: fastest.setting,
      why: `quickest setting that passes the rule: ${(fastest.meanLatencyMs / 1000).toFixed(1)} s per word on average.`,
    })
  }

  const worst = [...rows].filter((r) => r.hallucinationRate.value !== null).sort((a, b) => b.hallucinationRate.value! - a.hallucinationRate.value!)[0]
  if (worst && worst.hallucinationRate.value! > rule.maxH1) {
    out.push({
      title: "Avoid",
      setting: worst.setting,
      why: `highest H1: it accepted ${pctOf(worst.hallucinationRate.value)} of made-up words as real slang.`,
    })
  }
  return out
}

function pooled(runs: readonly SweepRun[], pick: (d: DiscoveryEvaluation) => Rate): Rate {
  return rate(
    runs.reduce((sum, r) => sum + pick(r.discovery).numerator, 0),
    runs.reduce((sum, r) => sum + pick(r.discovery).denominator, 0),
  )
}

function mean(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null)
  return known.length === 0 ? null : known.reduce((sum, v) => sum + v, 0) / known.length
}

const sameSetting = (a: SweepSetting, b: SweepSetting) => a.model === b.model && a.temperature === b.temperature
const orUnknown = (value: number | null) => value ?? Number.POSITIVE_INFINITY

export function summariseSweep(runs: readonly SweepRun[], given: SweepRule): SweepSummary {
  const rule = { maxH1: given.maxH1, minRecall: given.minRecall, maxErrorRate: given.maxErrorRate ?? DEFAULT_MAX_ERROR_RATE }
  const settings: SweepSetting[] = []
  for (const run of runs) if (!settings.some((s) => sameSetting(s, run.setting))) settings.push(run.setting)

  const rows = settings.map((setting): SweepRow => {
    const mine = runs.filter((r) => sameSetting(r.setting, setting))
    const hallucinationRate = pooled(mine, (d) => d.hallucinationRate)
    const recall = pooled(mine, (d) => d.recall)
    const perRun = mine.map((r) => r.discovery.hallucinationRate.value).filter((v): v is number => v !== null)
    const { auc, points } = rocCurve(acceptanceScores(mine))
    const errors = mine.reduce((sum, r) => sum + r.discovery.errorIds.length, 0)
    const calls = mine.reduce((sum, r) => sum + r.discovery.total, 0)
    const reliable = calls > 0 && errors / calls <= rule.maxErrorRate
    return {
      auc,
      roc: points,
      setting,
      runs: mine.length,
      hallucinationRate,
      hallucinationRange: perRun.length ? [Math.min(...perRun), Math.max(...perRun)] : null,
      precision: pooled(mine, (d) => d.precision),
      recall,
      falseAcceptRate: pooled(mine, (d) => d.falseAcceptRate),
      sensitivityMislabelRate: pooled(mine, (d) => d.sensitivityMislabelRate),
      errors,
      calls,
      reliable,
      costPer1000CallsUsd: mean(mine.map((r) => r.cost.costPer1000CallsUsd)),
      meanLatencyMs: mean(mine.map((r) => r.discovery.latency.meanMs)),
      acceptable:
        reliable &&
        hallucinationRate.value !== null &&
        hallucinationRate.value <= rule.maxH1 &&
        recall.value !== null &&
        recall.value >= rule.minRecall,
    }
  })

  const recommended =
    [...rows]
      .filter((r) => r.acceptable)
      .sort(
        (a, b) =>
          orUnknown(a.costPer1000CallsUsd) - orUnknown(b.costPer1000CallsUsd) ||
          orUnknown(a.meanLatencyMs) - orUnknown(b.meanLatencyMs),
      )[0] ?? null
  const closest = recommended
    ? null
    : ([...(rows.some((r) => r.reliable) ? rows.filter((r) => r.reliable) : rows)].sort(
        (a, b) =>
          orUnknown(a.hallucinationRate.value) - orUnknown(b.hallucinationRate.value) ||
          (b.recall.value ?? -1) - (a.recall.value ?? -1),
      )[0] ?? null)
  return { rule, rows, recommended, closest, recommendations: recommend(rows, rule) }
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const settingLabel = (s: SweepSetting, mock: boolean) => `${mock ? "mock, as " : ""}${s.model} @ ${s.temperature}`

export function sweepMarkdown(
  meta: {
    datasetVersion: string
    datasetSha256: string
    startedAt: string
    promptVersion: string
    mock: boolean
    split?: string
    combinedFrom?: { file: string; models: string[] }[]
  },
  summary: SweepSummary,
): string {
  const label = (s: SweepSetting) => settingLabel(s, meta.mock)
  const lines = [
    `# Settings sweep: ${meta.mock ? "MOCK model (checks the sweep runs; not a real result)" : "discovery model comparison"}`,
    "",
    `- Dataset: golden set v${meta.datasetVersion}, sha256 \`${meta.datasetSha256.slice(0, 12)}\``,
    `- Prompt: \`${meta.promptVersion}\``,
    `- Started: ${meta.startedAt}`,
    ...(meta.split ? [`- Split: ${meta.split} cases only`] : []),
    ...(meta.combinedFrom
      ? [
          `- Combined from ${meta.combinedFrom.length} sweep reports (each model's rows come from one report): ` +
            meta.combinedFrom.map((c) => `\`${c.file}\` (${c.models.join(", ")})`).join("; "),
        ]
      : []),
    `- Rule: acceptable when H1 ≤ ${pct(summary.rule.maxH1)} and recall ≥ ${pct(summary.rule.minRecall)}` +
      `, with no more than ${pct(summary.rule.maxErrorRate)} of calls failed; then cheapest per 1,000 calls, then fastest.`,
    meta.mock
      ? "- The mock ignores model and temperature, so every row is the same by design."
      : "- Local models are weaker than the production model, so these absolute rates will not transfer; compare the rows with each other.",
    "",
    "| Setting | Runs | H1 made-up accepted (pooled) | H1 per-run range | False-accept | Precision | Recall | AUC | Mislabels | Errors | Cost / 1,000 calls | Mean latency | Acceptable |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...summary.rows.map(
      (r) =>
        `| ${[
        label(r.setting),
        r.runs,
        formatRate(r.hallucinationRate),
        r.hallucinationRange ? `${pct(r.hallucinationRange[0])}–${pct(r.hallucinationRange[1])}` : "n/a",
        formatRate(r.falseAcceptRate),
        formatRate(r.precision),
        formatRate(r.recall),
        r.auc === null ? "n/a" : r.auc.toFixed(2),
        formatRate(r.sensitivityMislabelRate),
        r.calls ? `${r.errors} of ${r.calls}${r.reliable ? "" : " ⚠"}` : r.errors,
        formatUsd(r.costPer1000CallsUsd),
        r.meanLatencyMs === null ? "n/a" : `${r.meanLatencyMs.toFixed(0)} ms`,
          r.acceptable ? "yes" : "no",
        ].join(" | ")} |`,
    ),
    "",
    ...(summary.rows.some((r) => !r.reliable)
      ? [
          `⚠ Left out of every recommendation, because more than ${pct(summary.rule.maxErrorRate)} of their calls failed and the rates rest on too few answers: ` +
            `${summary.rows.filter((r) => !r.reliable).map((r) => label(r.setting)).join(", ")}. Rerun these before comparing them.`,
          "",
        ]
      : []),
    "Pooled intervals count every repeat as a separate draw of the same words, so they are narrower than a fresh set of words would give.",
    "",
    "AUC scores each word by the share of repeats that accepted it, then asks how well that score ranks real slang above made-up and ordinary words " +
      "(1.00 perfect, 0.50 a coin flip). With one repeat, or at temperature 0 where repeats agree, every score is 0 or 1 and AUC equals balanced accuracy.",
    "",
    "## Business recommendations",
    "",
    ...(summary.recommendations.length
      ? summary.recommendations.map((r) => `- **${r.title}: ${label(r.setting)}**: ${r.why}`)
      : ["- Not enough results to recommend anything yet."]),
    "",
    "## Decision summary (W18EDATE-72)",
    "",
    summary.recommended
      ? `Recommended: **${label(summary.recommended.setting)}**: H1 ${formatRate(summary.recommended.hallucinationRate)}, ` +
        `recall ${formatRate(summary.recommended.recall)}, ${formatUsd(summary.recommended.costPer1000CallsUsd)} per 1,000 calls.`
      : `No setting meets the rule. Closest: **${summary.closest ? label(summary.closest.setting) : "none"}**` +
        (summary.closest
          ? `: H1 ${formatRate(summary.closest.hallucinationRate)}, recall ${formatRate(summary.closest.recall)}.`
          : "."),
    "",
    "H2 (wrong meanings for real slang) needs human labels of the saved answers (W18EDATE-71, Sprint 3) and is not in this table.",
    "",
  ]
  return lines.join("\n")
}

type SweepMeta = Parameters<typeof sweepMarkdown>[0]

export function sweepBaseName(meta: SweepMeta, summary: SweepSummary): string {
  const stamp = meta.startedAt.replace(/[:.]/g, "-").replace(/Z$/, "")
  const models = meta.mock ? "mock" : [...new Set(summary.rows.map((r) => r.setting.model))].join("+")
  return `${stamp}-sweep${meta.combinedFrom ? "-combined" : ""}-${models.replace(/[^a-z0-9.+-]+/gi, "_")}`
}

// `pnpm eval --combine a.json,b.json`: one table and chart from several saved
// sweeps. Each model's runs come from the LAST report that has that model, so a
// rerun of a few models replaces their old rows and keeps everyone else's.
// Reports only combine when they asked the same words the same way (same
// golden-set hash, prompt and split), or the comparison would not be fair.
export interface SavedSweep {
  file: string
  datasetVersion: string
  datasetSha256: string
  startedAt: string
  promptVersion: string
  mock: boolean
  split?: string
  runs: SweepRun[]
}

export function combineSweeps(saved: readonly SavedSweep[], startedAt: string): { meta: SweepMeta; runs: SweepRun[] } {
  if (saved.length === 0) throw new Error("--combine needs at least one sweep report (.json)")
  const first = saved[0]
  for (const s of saved.slice(1)) {
    const differs = [
      s.datasetSha256 !== first.datasetSha256 && `golden set (sha256 ${s.datasetSha256.slice(0, 12)} vs ${first.datasetSha256.slice(0, 12)})`,
      s.promptVersion !== first.promptVersion && `prompt (${s.promptVersion} vs ${first.promptVersion})`,
      (s.split ?? "all") !== (first.split ?? "all") && `split (${s.split ?? "all"} vs ${first.split ?? "all"})`,
      s.mock !== first.mock && "mock vs real model",
    ].filter(Boolean)
    if (differs.length) throw new Error(`Can't combine ${s.file} with ${first.file}: different ${differs.join(", ")}. Rerun them on the same words.`)
  }
  const source = new Map<string, number>()
  saved.forEach((s, i) => s.runs.forEach((r) => source.set(r.setting.model, i)))
  const order = [...new Set(saved.flatMap((s) => s.runs.map((r) => r.setting.model)))]
  const runs = order.flatMap((model) => saved[source.get(model)!].runs.filter((r) => r.setting.model === model))
  const combinedFrom = saved
    .map((s, i) => ({ file: s.file, models: order.filter((m) => source.get(m) === i) }))
    .filter((c) => c.models.length > 0)
  return {
    meta: {
      datasetVersion: first.datasetVersion,
      datasetSha256: first.datasetSha256,
      startedAt,
      promptVersion: first.promptVersion,
      mock: first.mock,
      ...(first.split ? { split: first.split } : {}),
      combinedFrom,
    },
    runs,
  }
}


export function writeSweepReport(dir: string, meta: SweepMeta, summary: SweepSummary, runs: readonly SweepRun[]) {
  mkdirSync(dir, { recursive: true })
  const base = path.join(dir, sweepBaseName(meta, summary))
  const markdownText = sweepMarkdown(meta, summary)
  writeFileSync(`${base}.json`, `${JSON.stringify({ ...meta, summary, runs }, null, 2)}\n`)
  writeFileSync(`${base}.md`, markdownText)
  const svg = rocSvg(summary.rows, meta.mock ? "ROC (mock model: checks the chart, not a real result)" : "ROC: real slang vs everything else")
  if (svg) writeFileSync(`${base}.roc.svg`, svg)
  return { json: `${base}.json`, markdown: `${base}.md`, roc: svg ? `${base}.roc.svg` : null, markdownText }
}
