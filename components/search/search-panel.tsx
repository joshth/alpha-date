"use client"

import { useState } from "react"
import { RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CrisisCard } from "@/components/safety/crisis-card"
import { HelpResources } from "@/components/safety/help-resources"
import { searchTerm, suggestTerm } from "@/app/lab/actions"
import type { SearchOutcome } from "@/lib/types"
import type { SlangTerm } from "@/app/types"

function TermCard({ term, badge, note }: { term: SlangTerm; badge: string; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2 className="text-xl">{term.term}</h2>
        </CardTitle>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">{badge}</Badge>
          <Badge variant={term.sensitivityRating === "Generally Harmless" ? "outline" : "destructive"}>
            {term.sensitivityRating}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {note && <p className="text-sm font-medium text-foreground">{note}</p>}
        <p className="leading-relaxed text-foreground">{term.definition}</p>
        {term.examples.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {term.examples.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function SuggestForm({ query }: { query: string }) {
  const [context, setContext] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        try {
          const result = await suggestTerm(query, context)
          setMessage(result.message)
        } catch {
          setMessage("Could not reach the service. Please try again.")
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-foreground">
        We couldn&apos;t find &quot;{query}&quot;. Suggest it for our next update?
      </p>
      <div className="space-y-2">
        <Label htmlFor="suggest-context">Where did you hear it? (optional)</Label>
        <Input id="suggest-context" value={context} maxLength={500} onChange={(e) => setContext(e.target.value)} />
      </div>
      <Button type="submit" variant="secondary" disabled={busy}>
        Suggest &quot;{query}&quot;
      </Button>
      {message && (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      )}
    </form>
  )
}

export function SearchPanel() {
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null)

  const run = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      setOutcome(await searchTerm(query))
    } catch {
      setOutcome({ kind: "error", message: "Could not reach the service. Please try again." })
    } finally {
      setBusy(false)
    }
  }

  const sensitive = outcome && "verdict" in outcome && outcome.verdict.categories.length > 0

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="query">Slang term or phrase</Label>
          <Input id="query" value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <Button type="submit" disabled={busy || !query.trim()}>
          {busy ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" aria-hidden="true" /> Search
            </>
          )}
        </Button>
      </form>

      <div aria-live="polite" className="space-y-4">
        {outcome?.kind === "safeguarding" && outcome.verdict.crisis && (
          <CrisisCard crisis={outcome.verdict.crisis} categories={outcome.verdict.categories} />
        )}
        {outcome?.kind === "refused" && (
          <>
            <p role="alert" className="text-foreground">
              {outcome.message}
            </p>
            <HelpResources categories={outcome.verdict.categories.length ? outcome.verdict.categories : ["bullying_harassment"]} />
          </>
        )}
        {outcome?.kind === "found" && <TermCard term={outcome.term} badge="In the lexicon" />}
        {outcome?.kind === "discovered" && <TermCard term={outcome.term} badge="AI-discovered" note={outcome.note} />}
        {outcome?.kind === "not_found" && <SuggestForm key={outcome.query} query={outcome.query} />}
        {outcome?.kind === "error" && (
          <p role="alert" className="text-destructive">
            {outcome.message}
          </p>
        )}
        {sensitive && outcome.kind !== "safeguarding" && outcome.kind !== "refused" && (
          <HelpResources categories={outcome.verdict.categories} />
        )}
        {outcome && "verdict" in outcome && (
          <p className="text-xs text-muted-foreground">
            Safety gate: {outcome.verdict.action} · decided by {outcome.verdict.decidedBy} · {outcome.verdict.reason}
          </p>
        )}
      </div>
    </div>
  )
}
