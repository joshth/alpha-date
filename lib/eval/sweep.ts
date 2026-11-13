import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { type CostSummary, formatUsd, type RunTiming } from "@/lib/eval/cost"
import type { DiscoveryEvaluation } from "@/lib/eval/discovery"
import { formatRate, type Rate, rate } from "@/lib/eval/metrics"
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
// acceptable = H1 ≤ maxH1 and recall ≥ minRecall; recommend the cheapest
// acceptable setting per 1,000 calls, then the fastest.

export const DEFAULT_TEMPERATURES = [0, 0.7, 1.3]
export const DEFAULT_REPEATS = 3
export const DEFAULT_MAX_H1 = 0.1
export const DEFAULT_MIN_RECALL = 0.5

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
  costPer1000CallsUsd: number | null
  meanLatencyMs: number | null
  acceptable: boolean
}

export interface SweepSummary {
  rule: { maxH1: number; minRecall: number }
  rows: SweepRow[]
  recommended: SweepRow | null
  closest: SweepRow | null
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

export function summariseSweep(runs: readonly SweepRun[], rule: { maxH1: number; minRecall: number }): SweepSummary {
  const settings: SweepSetting[] = []
  for (const run of runs) if (!settings.some((s) => sameSetting(s, run.setting))) settings.push(run.setting)

  const rows = settings.map((setting): SweepRow => {
    const mine = runs.filter((r) => sameSetting(r.setting, setting))
    const hallucinationRate = pooled(mine, (d) => d.hallucinationRate)
    const recall = pooled(mine, (d) => d.recall)
    const perRun = mine.map((r) => r.discovery.hallucinationRate.value).filter((v): v is number => v !== null)
    return {
      setting,
      runs: mine.length,
      hallucinationRate,
      hallucinationRange: perRun.length ? [Math.min(...perRun), Math.max(...perRun)] : null,
      precision: pooled(mine, (d) => d.precision),
      recall,
      falseAcceptRate: pooled(mine, (d) => d.falseAcceptRate),
      sensitivityMislabelRate: pooled(mine, (d) => d.sensitivityMislabelRate),
      errors: mine.reduce((sum, r) => sum + r.discovery.errorIds.length, 0),
      costPer1000CallsUsd: mean(mine.map((r) => r.cost.costPer1000CallsUsd)),
      meanLatencyMs: mean(mine.map((r) => r.discovery.latency.meanMs)),
      acceptable:
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
    : ([...rows].sort(
        (a, b) =>
          orUnknown(a.hallucinationRate.value) - orUnknown(b.hallucinationRate.value) ||
          (b.recall.value ?? -1) - (a.recall.value ?? -1),
      )[0] ?? null)
  return { rule, rows, recommended, closest }
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const settingLabel = (s: SweepSetting, mock: boolean) => `${mock ? "mock, as " : ""}${s.model} @ ${s.temperature}`

export function sweepMarkdown(
  meta: { datasetVersion: string; datasetSha256: string; startedAt: string; promptVersion: string; mock: boolean; split?: string },
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
    `- Rule: acceptable when H1 ≤ ${pct(summary.rule.maxH1)} and recall ≥ ${pct(summary.rule.minRecall)}; ` +
      "then cheapest per 1,000 calls, then fastest.",
    meta.mock
      ? "- The mock ignores model and temperature, so every row is the same by design."
      : "- Local models are weaker than the production model, so these absolute rates will not transfer; compare the rows with each other.",
    "",
    "| Setting | Runs | H1 made-up accepted (pooled) | H1 per-run range | Precision | Recall | Mislabels | Errors | Cost / 1,000 calls | Mean latency | Acceptable |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...summary.rows.map(
      (r) =>
        `| ${[
        label(r.setting),
        r.runs,
        formatRate(r.hallucinationRate),
        r.hallucinationRange ? `${pct(r.hallucinationRange[0])}–${pct(r.hallucinationRange[1])}` : "n/a",
        formatRate(r.precision),
        formatRate(r.recall),
        formatRate(r.sensitivityMislabelRate),
        r.errors,
        formatUsd(r.costPer1000CallsUsd),
        r.meanLatencyMs === null ? "n/a" : `${r.meanLatencyMs.toFixed(0)} ms`,
          r.acceptable ? "yes" : "no",
        ].join(" | ")} |`,
    ),
    "",
    "Pooled intervals count every repeat as a separate draw of the same words, so they are narrower than a fresh set of words would give.",
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
  return `${stamp}-sweep-${models.replace(/[^a-z0-9.+-]+/gi, "_")}`
}


export function writeSweepReport(dir: string, meta: SweepMeta, summary: SweepSummary, runs: readonly SweepRun[]) {
  mkdirSync(dir, { recursive: true })
  const base = path.join(dir, sweepBaseName(meta, summary))
  const markdownText = sweepMarkdown(meta, summary)
  writeFileSync(`${base}.json`, `${JSON.stringify({ ...meta, summary, runs }, null, 2)}\n`)
  writeFileSync(`${base}.md`, markdownText)
  return { json: `${base}.json`, markdown: `${base}.md`, markdownText }
}
