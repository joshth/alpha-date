// Fits one term with the vendored `python -m sirs.fit_term` (see sirs/src/sirs/fit_term.py).
import { spawn } from "node:child_process"
import { z } from "zod"
import { plotCommand, type PlotCommand } from "./plot-command"

/** Must equal MODEL_VERSION in sirs/src/sirs/fit_term.py (a test checks). */
export const MODEL_VERSION = "sirs-trackB-feedback/1"

export type FitCommand = PlotCommand & { input?: string }
export type SyntheticCountsByTerm = Record<string, { weeks: string[]; counts: number[]; generation?: string }>

export function fitCommand(term: string, opts: { now?: string; counts?: { weeks: string[]; counts: number[] } } = {},
  env: NodeJS.Dict<string> = process.env, repoRoot = process.cwd(), platform: NodeJS.Platform = process.platform): FitCommand {
  if (!term.trim()) throw new Error("fitCommand needs a term")
  const base = plotCommand([term], env, repoRoot, platform)
  return {
    ...base,
    args: ["-m", "sirs.fit_term", term, "--json", ...(opts.now ? ["--now", opts.now] : []), ...(opts.counts ? ["--counts"] : [])],
    ...(opts.counts ? { input: JSON.stringify(opts.counts) } : {}),
  }
}

export function fitBatchCommand(terms: string[], opts: { now?: string; counts?: SyntheticCountsByTerm } = {},
  env: NodeJS.Dict<string> = process.env, repoRoot = process.cwd(), platform: NodeJS.Platform = process.platform): FitCommand {
  if (!terms.length) throw new Error("fitBatchCommand needs at least one term")
  const base = plotCommand(["batch"], env, repoRoot, platform)
  return {
    ...base,
    args: ["-m", "sirs.fit_term", "--json", "--batch", ...(opts.now ? ["--now", opts.now] : [])],
    input: JSON.stringify({ terms, counts: opts.counts ?? {} }),
  }
}

const series = z.array(z.number())
const sirsFit = z.object({
  term: z.string(), generation: z.string(), modelVersion: z.string(), now: z.string(),
  weeks: z.array(z.string()), counts: series,
  fitted: z.object({ I: series, S: series, R: series, Gamma: series }),
  r: z.number(), delta: z.number(),
  stage: z.enum(["emerging", "peaking", "declining", "parent_territory"]).nullable(),
  confidence: z.number(), peakWeek: z.string(), windowStart: z.string(),
}).refine((f) => [f.counts, ...Object.values(f.fitted)].every((s) => s.length === f.weeks.length), "series length must equal weeks.length")

export type SirsFit = z.infer<typeof sirsFit>

export type ParsedBatchFit =
  | { kind: "fit"; source: "vendored" | "synthetic"; fit: SirsFit }
  | { kind: "no_data" }

export function parseFit(stdout: string): { kind: "fit"; fit: SirsFit } | { kind: "no_data" } {
  const data = JSON.parse(stdout)
  if (data?.error === "no_data") return { kind: "no_data" }
  return { kind: "fit", fit: sirsFit.parse(data) }
}

export function parseFitBatch(stdout: string): Record<string, ParsedBatchFit> {
  const data = JSON.parse(stdout)
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("SIRS batch output must be an object")
  return Object.fromEntries(Object.entries(data).map(([term, value]) => {
    if (value && typeof value === "object" && "kind" in value && value.kind === "no_data") {
      return [term, { kind: "no_data" }]
    }
    const wrapper = z.object({ kind: z.literal("fit"), source: z.enum(["vendored", "synthetic"]), fit: sirsFit }).parse(value)
    return [term, wrapper]
  }))
}

export function runFit(c: FitCommand): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(c.cmd, c.args, { cwd: c.cwd, env: c.env as NodeJS.ProcessEnv, stdio: "pipe" })
    let stdout = ""
    const timer = setTimeout(() => { child.kill(); reject(new Error("sirs.fit_term timed out")) }, 60_000)
    child.stdout.on("data", (d) => { stdout += d })
    child.on("error", (e) => { clearTimeout(timer); reject(e) })
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout }) })
    if (c.input !== undefined) child.stdin.write(c.input)
    child.stdin.end()
  })
}
