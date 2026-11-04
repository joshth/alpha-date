"use client"

import { useState } from "react"
import { compareSafetyInput } from "@/app/lab/actions"
import { SafetyResponse } from "@/components/safety/safety-response"
import { safetyResponseMessage } from "@/lib/safety/responses"
import { SAFETY_ACTION_LABELS } from "@/lib/safety/examples"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SafetyComparison() {
  const [text, setText] = useState("i hate myself")
  const [result, setResult] = useState<Awaited<ReturnType<typeof compareSafetyInput>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <section aria-labelledby="comparison-heading" className="space-y-4 rounded-lg border p-4">
      <h2 id="comparison-heading" className="text-lg font-semibold">Compare the original rules and the combined gate</h2>
      <p className="text-sm text-muted-foreground">Use a synthetic phrase. This check does not save input or call discovery. Moderation uses the provider selected for this demo.</p>
      <form className="space-y-2" onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true); setError(""); setResult(null)
        try { setResult(await compareSafetyInput(text)) }
        catch { setError("Could not run the comparison. Please try again.") }
        finally { setBusy(false) }
      }}>
        <Label htmlFor="safety-comparison-input">Synthetic phrase</Label>
        <Input id="safety-comparison-input" maxLength={120} value={text} onChange={(event) => setText(event.target.value)} />
        <Button disabled={busy || !text.trim()}>{busy ? "Checking…" : "Compare safety checks"}</Button>
      </form>
      <div aria-live="polite" className="space-y-3">
        {error && <p role="alert">{error}</p>}
        {result && <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="font-semibold">Original rules</dt><dd>{result.baseline.crisis ? "Full support" : result.baseline.categories.length ? "Sensitive lookup" : "No signal"}</dd><dd className="text-sm">Categories: {result.baseline.categories.join(", ") || "none"}</dd></div>
            <div><dt className="font-semibold">Combined gate</dt><dd>{SAFETY_ACTION_LABELS[result.gate.action]}</dd><dd className="text-sm">Decided by {result.gate.decidedBy} · {result.gate.reason}</dd></div>
          </dl>
          {result.gate.action !== "safe" && <SafetyResponse verdict={result.gate} message={safetyResponseMessage(result.gate, "search")} />}
        </>}
      </div>
    </section>
  )
}
