import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { type CostSummary, formatUsd, type MeteredCall, type RunTiming, type TokenSource } from "@/lib/eval/cost"
import type { DiscoveryEvaluation } from "@/lib/eval/discovery"
import { formatRate } from "@/lib/eval/metrics"

// Run report for `pnpm eval --report`. Every report carries the dataset and
// configuration identifiers needed to reproduce it, and mock runs say so in
// the file name, the JSON and the first line of the Markdown, so a mock
// number is never mistaken for a real model's accuracy. Cost and time
// (W18EDATE-69) are filled in once the run finishes, shown in the header and
// the metrics table; estimated tokens are labelled as estimates. A run limited
// to the first N cases (the timing test) says so in its name and header.

export interface RunConfig {
  mock: boolean
  model: string
  promptVersion: string
  temperature: number | null
  seed: number | null
  baseURL: string | null
}

export interface RunMeta {
  datasetVersion: string
  datasetFile: string
  datasetSha256: string
  startedAt: string
  config: RunConfig
  finishedAt?: string
  timing?: RunTiming
  cost?: CostSummary
  caseLimit?: number
}

export function sha256File(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

export function reportBaseName(meta: RunMeta): string {
  const stamp = meta.startedAt.replace(/[:.]/g, "-").replace(/Z$/, "")
  const model = meta.config.mock ? "mock" : meta.config.model.replace(/[^a-z0-9.-]+/gi, "_")
  return `${stamp}-discovery-${model}${meta.caseLimit ? `-first${meta.caseLimit}` : ""}`
}

// The header line a reader sees first: how long the run took and what it cost.
export function runSummaryLines(meta: RunMeta): string[] {
  const lines: string[] = []
  if (meta.caseLimit) lines.push(`- Timing test: first ${meta.caseLimit} discovery cases only`)
  if (meta.timing && meta.cost) {
    const perMinute = meta.timing.callsPerMinute === null ? "" : ` (${meta.timing.callsPerMinute.toFixed(0)} per minute)`
    lines.push(
      `- Time and cost: ${(meta.timing.wallClockMs / 1000).toFixed(1)} s for ${meta.cost.calls} calls${perMinute}; ` +
        `${formatUsd(meta.cost.costUsd)} for the run, ${formatUsd(meta.cost.costPer1000CallsUsd)} per 1,000 calls ` +
        `(${meta.cost.pricing?.source ?? "no price known"})`,
    )
  }
  return lines
}

export function costLines(cost: CostSummary | undefined, timing: RunTiming | undefined): string[] {
  const lines: string[] = []
  if (timing) {
    lines.push(
      `| Wall-clock time | ${(timing.wallClockMs / 1000).toFixed(1)} s` +
        (timing.callsPerMinute === null ? "" : ` (${timing.callsPerMinute.toFixed(0)} calls per minute)`) +
        " |",
    )
  }
  if (cost) {
    const label = cost.tokenSource === "provider" ? "reported by the provider" : cost.tokenSource === "estimate" ? "estimated, 4 characters per token" : cost.tokenSource
    lines.push(
      `| Tokens (${label}) | ${cost.promptTokens} in + ${cost.completionTokens} out = ${cost.totalTokens} |`,
      `| Cost of this run | ${formatUsd(cost.costUsd)} (${cost.pricing?.source ?? "no price known; set LLM_PRICE_*"}) |`,
      `| Cost per 1,000 calls | ${formatUsd(cost.costPer1000CallsUsd)} |`,
    )
  }
  return lines
}

export function toMarkdown(meta: RunMeta, discovery: DiscoveryEvaluation): string {
  const { config } = meta
  const lines = [
    `# Discovery evaluation: ${config.mock ? "MOCK model (not a real accuracy claim)" : config.model}`,
    "",
    `- Dataset: golden set v${meta.datasetVersion}, sha256 \`${meta.datasetSha256.slice(0, 12)}\``,
    `- Prompt: \`${config.promptVersion}\``,
    `- Model: ${config.mock ? "mock (lib/_stubs/fixtures/mock-discovery.ts)" : config.model}` +
      `; temperature ${config.temperature ?? "n/a"}; seed ${config.seed ?? "none"}` +
      (config.baseURL ? `; base URL ${config.baseURL}` : ""),
    `- Started: ${meta.startedAt}`,
    `- Cases: ${discovery.total} discovery cases, ${discovery.scored} scored, ${discovery.errorIds.length} provider errors`,
    ...runSummaryLines(meta),
    "",
    "| Metric | Result |",
    "| --- | --- |",
    `| Precision | ${formatRate(discovery.precision)} |`,
    `| Recall | ${formatRate(discovery.recall)} |`,
    `| H1 hallucination rate (invented accepted) | ${formatRate(discovery.hallucinationRate)} |`,
    `| False-accept rate (any non-slang accepted) | ${formatRate(discovery.falseAcceptRate)} |`,
    `| Sensitivity mislabels | ${formatRate(discovery.sensitivityMislabelRate)} |`,
    `| Calls / mean / p95 latency | ${discovery.calls} / ${discovery.latency.meanMs?.toFixed(1) ?? "n/a"} ms / ${discovery.latency.p95Ms?.toFixed(1) ?? "n/a"} ms |`,
    ...costLines(meta.cost, meta.timing),
    "",
    "| Confusion | Golden: real slang | Golden: not slang |",
    "| --- | --- | --- |",
    `| Model accepted | ${discovery.confusion.truePositive} | ${discovery.confusion.falsePositive} |`,
    `| Model rejected | ${discovery.confusion.falseNegative} | ${discovery.confusion.trueNegative} |`,
    "",
    `Hallucinated: ${discovery.hallucinatedIds.join(", ") || "none"}`,
    "",
    `Missed real slang: ${discovery.falseNegativeIds.join(", ") || "none"}`,
    "",
    `Sensitivity mislabels: ${discovery.sensitivityMislabelIds.join(", ") || "none"}`,
    "",
    "Definitions are in lib/eval/discovery.ts. Safety cases are not sent to the model and are not listed here.",
    "",
  ]
  return lines.join("\n")
}

// The run log (W18EDATE-69): one JSON line per model call with the case id,
// settings, answer, seconds and tokens. It carries the case id, never the
// input, and only discovery cases are ever sent to the model, so it can't hold
// safety-case text. A failed call has no token count (it was never metered).
export interface CallLogLine {
  caseId: string
  model: string
  temperature: number | null
  seed: number | null
  promptVersion: string
  accepted: boolean | null
  definition: string | null
  rating: string | null
  error: string | null
  seconds: number
  promptTokens: number | null
  completionTokens: number | null
  tokenSource: TokenSource | null
}

export function callLog(meta: RunMeta, discovery: DiscoveryEvaluation, calls: readonly MeteredCall[]): CallLogLine[] {
  // Calls were metered in the order they were made, so the nth successful
  // call for a word belongs to the nth result for that word.
  const metered = new Map<string, MeteredCall[]>()
  for (const call of calls) metered.set(call.searchTerm, [...(metered.get(call.searchTerm) ?? []), call])
  return discovery.results.map((r) => {
    const call = r.error === null ? metered.get(r.input)?.shift() : undefined
    return {
      caseId: r.id,
      model: meta.config.model,
      temperature: meta.config.temperature,
      seed: meta.config.seed,
      promptVersion: meta.config.promptVersion,
      accepted: r.accepted,
      definition: r.definition,
      rating: r.rating,
      error: r.error,
      seconds: Number((r.latencyMs / 1000).toFixed(3)),
      promptTokens: call?.promptTokens ?? null,
      completionTokens: call?.completionTokens ?? null,
      tokenSource: call?.source ?? null,
    }
  })
}

export function writeReport(
  dir: string,
  meta: RunMeta,
  discovery: DiscoveryEvaluation,
  calls: readonly MeteredCall[] = [],
): { json: string; markdown: string; log: string } {
  mkdirSync(dir, { recursive: true })
  const base = path.join(dir, reportBaseName(meta))
  const json = `${base}.json`
  const markdown = `${base}.md`
  const log = `${base}.calls.jsonl`
  writeFileSync(json, `${JSON.stringify({ ...meta, discovery }, null, 2)}\n`)
  writeFileSync(markdown, toMarkdown(meta, discovery))
  writeFileSync(log, callLog(meta, discovery, calls).map((line) => `${JSON.stringify(line)}\n`).join(""))
  return { json, markdown, log }
}
