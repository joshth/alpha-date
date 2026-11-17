"use client"
import { useId, useMemo, useState } from "react"
import { searchDemo } from "@/lib/dedup/search-demo"
import { CHINESE_NUMBER_EXAMPLES } from "@/lib/normalise"

type Result = ReturnType<typeof searchDemo>

export function DedupSearchView({ text, result, onChange }: { text: string; result: Result; onChange?: (t: string) => void }) {
  const id = useId()
  return (
    <section className="space-y-3 rounded border border-lab-border p-4">
      <label htmlFor={id} className="text-xs text-lab-muted">Suggestion</label>
      <input id={id} value={text} onChange={(e) => onChange?.(e.target.value)} className="h-9 w-full rounded border border-lab-border-strong bg-lab-input px-3 text-sm" />
      <div className="space-y-2">
        <p className="text-xs text-lab-muted">Chinese number examples</p>
        <div className="flex flex-wrap gap-2">
          {CHINESE_NUMBER_EXAMPLES.map(({ number, phrase, meaning }) => (
            <button key={number} type="button" aria-pressed={text === number} onClick={() => onChange?.(number)}
              className="min-h-11 rounded border border-lab-border-strong px-3 py-2 text-left text-xs hover:bg-lab-input focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <span className="font-mono">{number}</span> · <span lang="zh">{phrase}</span> · {meaning}
            </button>
          ))}
        </div>
      </div>
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
