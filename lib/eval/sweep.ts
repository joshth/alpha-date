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

export function parseSweepArgs(argv: readonly string[], currentModel: string): SweepOptions {
  const models = (flagValue(argv, "--models") ?? currentModel)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
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

const SWEPT_KEYS = ["LLM_MODEL", "LLM_TEMPERATURE", "LLM_SEED"] as const

// Runs `fn` with discovery switched to one setting, then puts the environment back.
export async function withDiscoverySetting<T>(setting: SweepSetting, repeat: number, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(SWEPT_KEYS.map((key) => [key, process.env[key]]))
  const baseSeed = process.env.LLM_SEED?.trim()
  process.env.LLM_MODEL = setting.model
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

