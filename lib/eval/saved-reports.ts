import "server-only"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { buildModelReports, isSavedCombinedReport, type ModelReports } from "./model-reports"

// Reads the newest combined sweep report (`pnpm eval --combine`) from
// eval/reports for the Lab's Model reports page. Read-only: the page never
// runs a model, so it costs nothing and needs no API key.

export const REPORTS_DIR = join(process.cwd(), "eval", "reports")
const COMBINED = /-sweep-combined-.*\.json$/

export type LoadedReports = { ok: true; reports: ModelReports } | { ok: false; reason: string }

export async function loadModelReports(dir = REPORTS_DIR): Promise<LoadedReports> {
  let files: string[]
  try {
    files = (await readdir(dir)).filter((f) => COMBINED.test(f)).sort()
  } catch {
    return { ok: false, reason: `No reports folder at ${dir}.` }
  }
  const file = files.at(-1)
  if (!file) return { ok: false, reason: "No combined sweep report yet. Run a sweep, then pnpm eval --combine." }
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(join(dir, file), "utf8"))
  } catch {
    return { ok: false, reason: `${file} is not valid JSON.` }
  }
  if (!isSavedCombinedReport(parsed)) return { ok: false, reason: `${file} is not a sweep report.` }
  return { ok: true, reports: buildModelReports(parsed, file) }
}
