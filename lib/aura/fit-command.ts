// Fits one term with the vendored `python -m sirs.fit_term` (see sirs/src/sirs/fit_term.py).
import { spawn } from "node:child_process"
import { z } from "zod"
import { plotCommand, type PlotCommand } from "./plot-command"

/** Must equal MODEL_VERSION in sirs/src/sirs/fit_term.py (a test checks). */
export const MODEL_VERSION = "sirs-trackB-feedback/1"

export type FitCommand = PlotCommand & { input?: string }

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

export function parseFit(stdout: string): { kind: "fit"; fit: SirsFit } | { kind: "no_data" } {
  const data = JSON.parse(stdout)
  if (data?.error === "no_data") return { kind: "no_data" }
  return { kind: "fit", fit: sirsFit.parse(data) }
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
