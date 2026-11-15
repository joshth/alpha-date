import type { DiscoveryCaseResult } from "./discovery"
import type { WordType } from "./golden"
import type { Rate } from "./metrics"
import type { Recommendation, SweepRow, SweepRule, SweepRun } from "./sweep"

// The Lab's "Model reports" page (F2.2): one saved, combined sweep report
// turned into a per-model view for the live demo. Every number is read from
// the report; nothing is re-run or estimated here.

export interface SavedCombinedReport {
  datasetVersion: string
  startedAt: string
  promptVersion: string
  mock: boolean
  split: string
  summary: { rule: Required<SweepRule>; rows: SweepRow[]; recommendations: Recommendation[] }
  runs: SweepRun[]
}

export interface Ratio { numerator: number; denominator: number; value: number | null }

export interface WordTypeShare {
  wordType: WordType
  label: string
  real: boolean
  accepted: number
  answered: number
  share: number | null
}

export interface WordMistake { word: string; times: number; of: number }

export interface SettingView {
  temperature: number
  runs: number
  calls: number
  errors: number
  reliable: boolean
  acceptable: boolean
  hallucination: Ratio
  hallucinationRange: [number, number] | null
  recall: Ratio
  precision: Ratio
  falseAccept: Ratio
  mislabel: Ratio
  auc: number | null
  roc: { fpr: number; tpr: number }[]
  costPer1000Usd: number | null
  meanLatencyMs: number | null
  verdict: string
  wordTypes: WordTypeShare[]
  madeUp: WordMistake[]
  missed: WordMistake[]
}

export interface ModelView {
  id: string
  label: string
  hosted: boolean
  bestIndex: number
  bestReason: string
  settings: SettingView[]
  recommendations: Recommendation[]
}

export interface ModelReports {
  file: string
  startedAt: string
  split: string
  datasetVersion: string
  promptVersion: string
  mock: boolean
  rule: Required<SweepRule>
  models: ModelView[]
  recommendations: Recommendation[]
}

const WORD_TYPE_LABELS: [WordType, string, boolean][] = [
  ["real-old", "Established slang", true],
  ["real-new", "New slang", true],
  ["new-sense", "Old word, new meaning", true],
  ["invented-plausible", "Made up, sounds real", false],
  ["invented-random", "Made up, random", false],
]

const NAMES: Record<string, string> = {
  "llama3.2:1b": "Llama 3.2 1B",
  "llama3.2:3b": "Llama 3.2 3B",
  "deepseek-r1:1.5b": "DeepSeek R1 1.5B",
  "openai:gpt-4o-mini": "GPT-4o mini",
  "openai:gpt-4o": "GPT-4o",
  "openai:gpt-6-astra": "GPT-6 Astra",
}

export function modelLabel(model: string): string {
  return NAMES[model] ?? model.replace(/^openai:/, "")
}

const ratio = (r: Rate): Ratio => ({ numerator: r.numerator, denominator: r.denominator, value: r.value })
const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`)

export function settingVerdict(row: SweepRow, rule: Required<SweepRule>): string {
  if (!row.reliable) return `Unreliable: ${row.errors} of ${row.calls} calls failed (limit ${pct(rule.maxErrorRate)}), so it is never recommended.`
  if (row.acceptable) return `Passes the rule: H1 ${pct(row.hallucinationRate.value)} (limit ${pct(rule.maxH1)}) and recall ${pct(row.recall.value)} (at least ${pct(rule.minRecall)}).`
  const fails: string[] = []
  const h1 = row.hallucinationRate.value
  const recall = row.recall.value
  if (h1 === null || h1 > rule.maxH1) fails.push(`H1 ${pct(h1)} is above ${pct(rule.maxH1)}`)
  if (recall === null || recall < rule.minRecall) fails.push(`recall ${pct(recall)} is below ${pct(rule.minRecall)}`)
  return `Fails the rule: ${fails.join(" and ") || "it does not meet the rule"}.`
}

// Share of answered words the model accepted as real slang, per word type,
// over every repeat of one setting. Real types should be high, made-up low.
export function wordTypeShares(results: readonly DiscoveryCaseResult[]): WordTypeShare[] {
  return WORD_TYPE_LABELS.map(([wordType, label, real]) => {
    const answered = results.filter((r) => r.wordType === wordType && r.accepted !== null)
    const accepted = answered.filter((r) => r.accepted).length
    return { wordType, label, real, accepted, answered: answered.length, share: answered.length ? accepted / answered.length : null }
  }).filter((w) => w.answered > 0)
}

function mistakes(results: readonly DiscoveryCaseResult[], outcome: DiscoveryCaseResult["outcome"], repeats: number): WordMistake[] {
  const byWord = new Map<string, number>()
  for (const r of results) if (r.outcome === outcome) byWord.set(r.input, (byWord.get(r.input) ?? 0) + 1)
  return [...byWord].map(([word, times]) => ({ word, times, of: repeats })).sort((a, b) => b.times - a.times || a.word.localeCompare(b.word))
}

// The setting shown first for a model: the highest recall that passes the
// rule; if none passes, the lowest H1 among reliable settings; if none is
// reliable, the one with the fewest errors.
export function bestSettingIndex(rows: readonly SweepRow[]): { index: number; reason: string } {
  const indexed = rows.map((row, index) => ({ row, index }))
  const recall = (r: SweepRow) => r.recall.value ?? -1
  const h1 = (r: SweepRow) => r.hallucinationRate.value ?? 2
  const passing = indexed.filter((x) => x.row.acceptable)
  if (passing.length) {
    const best = passing.sort((a, b) => recall(b.row) - recall(a.row) || (b.row.auc ?? 0) - (a.row.auc ?? 0))[0]
    return { index: best.index, reason: "highest recall that passes the rule" }
  }
  const reliable = indexed.filter((x) => x.row.reliable)
  if (reliable.length) {
    const best = reliable.sort((a, b) => h1(a.row) - h1(b.row) || recall(b.row) - recall(a.row))[0]
    return { index: best.index, reason: "no setting passes the rule; this one makes up the fewest words" }
  }
  const best = indexed.sort((a, b) => a.row.errors - b.row.errors)[0]
  return { index: best?.index ?? 0, reason: "every setting failed too many calls; this one failed the fewest" }
}

const sameSetting = (a: { model: string; temperature: number }, b: { model: string; temperature: number }) =>
  a.model === b.model && a.temperature === b.temperature

export function buildModelReports(report: SavedCombinedReport, file: string): ModelReports {
  const { rule, rows, recommendations } = report.summary
  const order = [...new Set(rows.map((r) => r.setting.model))]
  const models = order.map((id): ModelView => {
    const modelRows = rows.filter((r) => r.setting.model === id).sort((a, b) => a.setting.temperature - b.setting.temperature)
    const settings = modelRows.map((row): SettingView => {
      const runs = report.runs.filter((run) => sameSetting(run.setting, row.setting))
      const results = runs.flatMap((run) => run.discovery.results)
      return {
        temperature: row.setting.temperature,
        runs: row.runs,
        calls: row.calls,
        errors: row.errors,
        reliable: row.reliable,
        acceptable: row.acceptable,
        hallucination: ratio(row.hallucinationRate),
        hallucinationRange: row.hallucinationRange,
        recall: ratio(row.recall),
        precision: ratio(row.precision),
        falseAccept: ratio(row.falseAcceptRate),
        mislabel: ratio(row.sensitivityMislabelRate),
        auc: row.auc,
        roc: row.roc.map(({ fpr, tpr }) => ({ fpr, tpr })),
        costPer1000Usd: row.costPer1000CallsUsd,
        meanLatencyMs: row.meanLatencyMs,
        verdict: settingVerdict(row, rule),
        wordTypes: wordTypeShares(results),
        madeUp: mistakes(results, "false_positive", runs.length),
        missed: mistakes(results, "false_negative", runs.length),
      }
    })
    const best = bestSettingIndex(modelRows)
    return {
      id,
      label: modelLabel(id),
      hosted: id.startsWith("openai:"),
      bestIndex: best.index,
      bestReason: best.reason,
      settings,
      recommendations: recommendations.filter((r) => r.setting.model === id),
    }
  })
  return {
    file,
    startedAt: report.startedAt,
    split: report.split,
    datasetVersion: report.datasetVersion,
    promptVersion: report.promptVersion,
    mock: report.mock,
    rule,
    models,
    recommendations,
  }
}

export function isSavedCombinedReport(value: unknown): value is SavedCombinedReport {
  const r = value as SavedCombinedReport | null
  return !!r && typeof r.startedAt === "string" && Array.isArray(r.runs) &&
    !!r.summary && Array.isArray(r.summary.rows) && Array.isArray(r.summary.recommendations) && !!r.summary.rule
}
