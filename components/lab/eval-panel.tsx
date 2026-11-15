"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { checkFile, runEval, type EvalReport, type FileCheck, type RowVerdict, type getBuckets } from "@/app/lab/eval/actions"

const LABEL: Record<string, string> = {
  correct: "correct", hallucination: "made it up", missed: "missed real slang", mislabel: "rated too safe",
}

export function EvalPanel({ info }: { info: Awaited<ReturnType<typeof getBuckets>> }) {
  const [report, setReport] = useState<EvalReport | null>(null)
  const [check, setCheck] = useState<FileCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<RowVerdict | null>(null)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Answer key v{info.version}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="flex flex-wrap gap-2" aria-label="Buckets">
            {info.buckets.map((b) => (
              <li key={b.name}><Badge variant="secondary">{b.name.replace("_", " ")} · {b.count}</Badge></li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Second reviewer: {info.reviewedBy ?? "not yet reviewed"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={async () => setCheck(await checkFile("answer-key"))}>Check the answer key</Button>
            <Button variant="outline" onClick={async () => setCheck(await checkFile("broken"))}>Check a broken file</Button>
          </div>
          {check && (
            <div role="status" className="space-y-1 text-sm">
              <Badge variant={check.ok ? "default" : "destructive"}>{check.ok ? "valid" : `${check.problems.length} problems`}</Badge>{" "}
              <span className="font-mono">{check.file}</span> · {check.cases} cases
              <ul className="list-disc pl-5 text-muted-foreground">
                {check.problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        disabled={busy}
        onClick={async () => { setBusy(true); try { setReport(await runEval()) } finally { setBusy(false) } }}
      >
        {busy ? "Running…" : "Run the evaluation"}
      </Button>

      {report && (
        <Card>
          <CardHeader><CardTitle>Result: {report.correct} / {report.total} correct</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ul className="flex flex-wrap gap-2" aria-label="Filter the results">
              {([["hallucination", "made it up", report.hallucinations], ["missed", "missed real slang", report.missed], ["mislabel", "rated too safe", report.mislabels], ["correct", "correct", report.correct]] as [RowVerdict, string, number][]).map(([v, label, n]) => (
                <li key={v}>
                  <button type="button" aria-pressed={filter === v} onClick={() => setFilter(filter === v ? null : v)}>
                    <Badge variant={filter === v ? "default" : v === "hallucination" ? "destructive" : "outline"}>{label} · {n}</Badge>
                  </button>
                </li>
              ))}
              <li><Badge variant="secondary">safety gate agrees · {report.gateAgreement} / {report.total}</Badge></li>
            </ul>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center text-sm" aria-label="Confusion matrix">
              <span />
              <span className="font-semibold">AI says real</span>
              <span className="font-semibold">AI says not slang</span>
              <span className="text-left font-semibold">Really slang</span>
              <span className="rounded bg-secondary p-2">true positive · {report.tp}</span>
              <span className="rounded border p-2">missed · {report.fn}</span>
              <span className="text-left font-semibold">Not slang</span>
              <span className="rounded border border-destructive p-2">made it up · {report.fp}</span>
              <span className="rounded bg-secondary p-2">true negative · {report.tn}</span>
            </div>
            <p className="text-sm">
              Precision {report.precision === null ? "-" : `${Math.round(report.precision * 100)}%`} · Recall{" "}
              {report.recall === null ? "-" : `${Math.round(report.recall * 100)}%`}
            </p>
            <table className="w-full text-left text-sm">
              <thead><tr className="text-muted-foreground"><th>Word</th><th>Bucket</th><th>Real?</th><th>AI said</th><th>Result</th></tr></thead>
              <tbody>
                {[...report.rows].filter((r) => !filter || r.verdict === filter).sort((a, b) => Number(a.verdict === "correct") - Number(b.verdict === "correct")).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1 font-mono">{r.input}</td>
                    <td>{r.category.replace("_", " ")}</td>
                    <td>{r.expectedReal ? "yes" : "no"}</td>
                    <td>{r.aiSaidReal ? "real" : "not slang"}</td>
                    <td><Badge variant={r.verdict === "correct" ? "outline" : "destructive"}>{LABEL[r.verdict]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
