"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { traceSearch, type Stage } from "@/app/lab/pipeline/actions"
import { SafetyResponse } from "@/components/safety/safety-response"
import { safetyResponseMessage } from "@/lib/safety/responses"
import type { SafetyVerdict } from "@/lib/safety/gate"

const NAMES = { safety: "1 · Safety gate", lookup: "2 · Lexicon lookup", discovery: "3 · AI discovery", store: "4 · Stored term" }
const CASES = ["rizz", "yap", "plimbcore", "zorbleflux", "i want to kill myself"]
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function PipelinePanel() {
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState<Stage[]>([])
  const [busy, setBusy] = useState(false)
  const [headline, setHeadline] = useState<string | null>(null)
  const [safeguarding, setSafeguarding] = useState<SafetyVerdict | null>(null)

  const run = async (q: string) => {
    setQuery(q); setBusy(true); setShown([]); setHeadline(null); setSafeguarding(null)
    try {
      const { stages, outcome } = await traceSearch(q)
      for (const s of stages) { setShown((p) => [...p, s]); await wait(700) }
      if (outcome.kind === "safeguarding") setSafeguarding(outcome.verdict)
      setHeadline(
        outcome.kind === "found" ? "Answered from the lexicon. No AI call." :
        outcome.kind === "discovered" ? `Stored "${outcome.term.term}" for human review.` :
        outcome.kind === "not_found" ? "Nothing stored. The AI found no slang." :
        outcome.kind === "safeguarding" ? "Stopped at the gate. Help links shown instead." :
        outcome.kind === "refused" ? "Stopped at the gate. Refused." : outcome.message,
      )
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" aria-label="Example searches">
        {CASES.map((c) => <Button key={c} variant="secondary" disabled={busy} onClick={() => run(c)}>{c}</Button>)}
      </div>
      <p className="font-mono text-lg" aria-live="polite">{query || "Pick a search"}</p>
      <ol className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(NAMES) as (keyof typeof NAMES)[]).map((id) => {
          const s = shown.find((x) => x.id === id)
          return (
            <li key={id}>
              <Card className={s ? (s.state === "stop" || s.state === "warn" ? "border-destructive" : s.state === "pass" ? "border-primary" : "opacity-50") : "opacity-40"}>
                <CardContent className="space-y-2 p-4">
                  <p className="font-semibold">{NAMES[id]}</p>
                  {s && <Badge variant={s.state === "stop" || s.state === "warn" ? "destructive" : s.state === "pass" ? "default" : "outline"}>{s.state === "pass" ? "passed" : s.state === "stop" ? "stopped here" : s.state === "warn" ? "hallucination" : "skipped"}</Badge>}
                  {s && <p className="text-sm text-muted-foreground">{s.detail}</p>}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ol>
      {headline && <p role="status" className="text-lg font-semibold text-foreground">{headline}</p>}
      {safeguarding && <SafetyResponse verdict={safeguarding} message={safetyResponseMessage(safeguarding, "search")} />}
    </div>
  )
}
