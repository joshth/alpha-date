import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { DiscoveryEvaluation } from "@/lib/eval/discovery"
import { formatRate } from "@/lib/eval/metrics"

// Run report for `pnpm eval --report`. Every report carries the dataset and
// configuration identifiers needed to reproduce it, and mock runs say so in
// the file name, the JSON and the first line of the Markdown, so a mock
// number is never mistaken for a real model's accuracy.

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
}

export function sha256File(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

export function reportBaseName(meta: RunMeta): string {
  const stamp = meta.startedAt.replace(/[:.]/g, "-").replace(/Z$/, "")
  const model = meta.config.mock ? "mock" : meta.config.model.replace(/[^a-z0-9.-]+/gi, "_")
  return `${stamp}-discovery-${model}`
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
    "",
    "| Metric | Result |",
    "| --- | --- |",
    `| Precision | ${formatRate(discovery.precision)} |`,
    `| Recall | ${formatRate(discovery.recall)} |`,
    `| H1 hallucination rate (invented accepted) | ${formatRate(discovery.hallucinationRate)} |`,
    `| False-accept rate (any non-slang accepted) | ${formatRate(discovery.falseAcceptRate)} |`,
    `| Sensitivity mislabels | ${formatRate(discovery.sensitivityMislabelRate)} |`,
    `| Calls / mean latency | ${discovery.calls} / ${discovery.latency.meanMs?.toFixed(1) ?? "n/a"} ms |`,
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

export function writeReport(dir: string, meta: RunMeta, discovery: DiscoveryEvaluation): { json: string; markdown: string } {
  mkdirSync(dir, { recursive: true })
  const base = path.join(dir, reportBaseName(meta))
  const json = `${base}.json`
  const markdown = `${base}.md`
  writeFileSync(json, `${JSON.stringify({ ...meta, discovery }, null, 2)}\n`)
  writeFileSync(markdown, toMarkdown(meta, discovery))
  return { json, markdown }
}
