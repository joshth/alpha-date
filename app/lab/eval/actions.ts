"use server"

import { readFileSync } from "node:fs"
import path from "node:path"
import { discoverTerm } from "@/lib/discovery/discover"
import { EVAL_CATEGORIES, RATING_ORDER, loadGoldenSet, validateGoldenSet } from "@/lib/eval/golden"
import { checkInputSafety } from "@/lib/safety/gate"
import { generateDiscoveryObject, isMockLlm } from "@/lib/_stubs/llm"
import { mockDiscovery } from "@/lib/_stubs/fixtures/mock-discovery"

export type RowVerdict = "correct" | "hallucination" | "missed" | "mislabel"
export interface EvalRow {
  id: string
  input: string
  category: string
  expectedReal: boolean
  aiSaidReal: boolean
  gateOk: boolean
  verdict: RowVerdict
}
export interface EvalReport {
  rows: EvalRow[]
  total: number
  correct: number
  hallucinations: number
  missed: number
  mislabels: number
  gateAgreement: number
  // confusion matrix, positive = the AI says "real slang"
  tp: number
  fp: number
  fn: number
  tn: number
  precision: number | null
  recall: number | null
}

// Same discovery logic as the app; the mock skips its 300 ms delay so 41 words finish fast.
const generate = (i: { prompt: string; searchTerm: string }) =>
  isMockLlm() ? Promise.resolve(mockDiscovery(i.searchTerm)) : generateDiscoveryObject(i)

export async function runEval(): Promise<EvalReport> {
  const cases = loadGoldenSet().cases.filter((c) => c.kind === "discovery")
  const rows = await Promise.all(cases.map(async (c): Promise<EvalRow> => {
    if (c.kind !== "discovery") throw new Error("unreachable")
    const verdict = await checkInputSafety(c.input, "search")
    const found = await discoverTerm(c.input, generate)
    const aiSaidReal = found !== null
    let v: RowVerdict = "correct"
    if (aiSaidReal && !c.discovery.isRealSlang) v = "hallucination"
    else if (!aiSaidReal && c.discovery.isRealSlang) v = "missed"
    else if (found && c.discovery.minSensitivity) {
      if (RATING_ORDER.indexOf(found.term.sensitivityRating) < RATING_ORDER.indexOf(c.discovery.minSensitivity)) v = "mislabel"
    }
    return {
      id: c.id, input: c.input, category: c.category, expectedReal: c.discovery.isRealSlang,
      aiSaidReal, gateOk: verdict.action === c.safety.action, verdict: v,
    }
  }))
  const n = (v: RowVerdict) => rows.filter((r) => r.verdict === v).length
  const count = (real: boolean, said: boolean) => rows.filter((r) => r.expectedReal === real && r.aiSaidReal === said).length
  const [tp, fp, fn, tn] = [count(true, true), count(false, true), count(true, false), count(false, false)]
  return {
    tp, fp, fn, tn,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    rows, total: rows.length, correct: n("correct"), hallucinations: n("hallucination"),
    missed: n("missed"), mislabels: n("mislabel"), gateAgreement: rows.filter((r) => r.gateOk).length,
  }
}

export interface Bucket { name: string; count: number }
export interface FileCheck { file: string; ok: boolean; cases: number; problems: string[]; reviewedBy: string | null }

export async function checkFile(which: "answer-key" | "broken"): Promise<FileCheck> {
  const file = which === "broken" ? path.join("tests", "fixtures", "golden-broken.json") : path.join("eval", "golden-set.json")
  const raw = JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8"))
  const { set, problems } = validateGoldenSet(raw)
  return {
    file, ok: set !== null, cases: Array.isArray(raw.cases) ? raw.cases.length : 0,
    problems: problems.slice(0, 6), reviewedBy: raw.review?.reviewer ?? null,
  }
}

export async function getBuckets(): Promise<{ version: string; buckets: Bucket[]; reviewedBy: string | null }> {
  const set = loadGoldenSet()
  const buckets = EVAL_CATEGORIES.map((name) => ({
    name,
    count: set.cases.filter((c) => c.kind !== "dedup" && c.category === name).length,
  }))
  return { version: set.version, buckets, reviewedBy: set.review?.reviewer ?? null }
}
