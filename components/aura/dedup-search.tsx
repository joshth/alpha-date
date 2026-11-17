"use client"
import { useId, useMemo, useState } from "react"
import { searchDemo } from "@/lib/dedup/search-demo"

type Result = ReturnType<typeof searchDemo>

export function DedupSearchView({ text, result, onChange }: { text: string; result: Result; onChange?: (t: string) => void }) {
  const id = useId()
  return (
    <section className="space-y-3 rounded border border-lab-border p-4">
      <label htmlFor={id} className="text-xs text-lab-muted">Suggestion</label>
      <input id={id} value={text} onChange={(e) => onChange?.(e.target.value)} className="h-9 w-full rounded border border-lab-border-strong bg-lab-input px-3 text-sm" />
      {result.key && (
        <>
          <p className="text-sm">key: <code className="font-mono">{result.key}</code></p>
          {result.matches.length === 0 ? <p className="text-sm text-lab-muted">No match: this would be a new term</p> : (
            <ul className="space-y-1 text-sm">
              {result.matches.map((m) => (
                <li key={m.candidate} className="flex justify-between gap-2"><span>{m.candidate}</span><span className="text-lab-muted">{m.label} <span className="font-mono tabular-nums">{m.score.toFixed(2)}</span></span></li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export function DedupSearch({ candidates }: { candidates: string[] }) {
  const [text, setText] = useState("")
  const result = useMemo(() => searchDemo(text, candidates), [text, candidates])
  return <DedupSearchView text={text} result={result} onChange={setText} />
}
