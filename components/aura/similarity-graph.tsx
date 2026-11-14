"use client"

import type { KeyboardEvent } from "react"
import type { Graph } from "@/lib/dedup/graph"
import { clusters, edgesAt } from "@/lib/dedup/nav"
import type { SemanticEdge } from "@/lib/dedup/semantic"

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

type Pos = { x: number; y: number; r: number }
type Key = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"
const tok = (n: string) => `hsl(var(--lab-${n}))`
const DASH = { same_key: undefined, trigram: "6 4", stem: "2 3" } as Record<string, string | undefined>
const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]

export function GraphView({ graph, positions, selectedId, threshold, size, onSelect, onMove, semanticEdges }: {
  graph: Graph; positions: Record<string, Pos>; selectedId: string | null; threshold: number; semanticEdges?: SemanticEdge[]
  size?: { width: number; height: number }; onSelect?: (id: string) => void; onMove?: (key: Key) => void
}) {
  const edges = edgesAt(graph, threshold)
  const linked = new Set(selectedId ? edges.filter((e) => e.source === selectedId || e.target === selectedId).flatMap((e) => [e.source, e.target]) : [])
  const stop = selectedId ?? graph.nodes[0]?.id
  const keys = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(id) }
    else if (ARROWS.includes(e.key)) { e.preventDefault(); onMove?.(e.key as Key) }
  }
  return (
    <svg role="group" aria-label="Similarity graph" viewBox={`0 0 ${size?.width ?? 640} ${size?.height ?? 400}`} className="h-auto w-full">
      {edges.map((e) => {
        const a = positions[e.source], b = positions[e.target]
        return <line key={e.id} data-edge-id={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={tok("border-strong")} strokeWidth={1.5} strokeDasharray={DASH[e.reason]} />
      })}
      {semanticEdges?.map((e) => {
        const a = positions[e.source], b = positions[e.target]
        if (!a || !b) return null
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, dx = (-(b.y - a.y) / len) * 1, dy = ((b.x - a.x) / len) * 1
        return (
          <g key={e.id} data-edge-kind="semantic" data-edge-id={e.id} aria-hidden="true">
            {[-1, 1].map((s) => <line key={s} x1={a.x + s * dx} y1={a.y + s * dy} x2={b.x + s * dx} y2={b.y + s * dy} stroke={tok("border-strong")} strokeWidth={1} />)}
          </g>
        )
      })}
      {graph.nodes.map((n) => {
        const p = positions[n.id], matches = edges.filter((e) => e.source === n.id || e.target === n.id).length
        const dim = selectedId && n.id !== selectedId && !linked.has(n.id)
        return (
          <g key={n.id} data-node-id={n.id} role="button" tabIndex={n.id === stop ? 0 : -1} aria-pressed={n.id === selectedId ? true : undefined}
            aria-label={`${n.label}, ${n.kind}, ${plural(n.count, "submission")}, ${plural(matches, "match", "matches")}`} opacity={dim ? 0.25 : undefined}
            onClick={() => onSelect?.(n.id)} onKeyDown={keys(n.id)} className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[hsl(var(--lab-primary))]">
            <circle cx={p.x} cy={p.y} r={p.r} fill={n.kind === "suggestion" ? tok("text-muted") : "none"} stroke={tok("text")} strokeWidth={n.id === selectedId ? 3 : 1.5} />
            <text x={p.x} y={p.y + p.r + 12} textAnchor="middle" fontSize={11} fill={tok("text")}>{n.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function GraphLegend({ semantic }: { semantic?: boolean }) {
  return (
    <ul aria-label="Edge types" className="flex gap-4 text-xs text-lab-text-muted">
      {([["Same key", "same_key"], ["Trigram", "trigram"], ["Stem", "stem"]] as const).map(([t, r]) => (
        <li key={r} className="flex items-center gap-2">
          <svg aria-hidden="true" width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke={tok("border-strong")} strokeWidth={1.5} strokeDasharray={DASH[r]} /></svg>
          {t}
        </li>
      ))}
      {semantic && (
        <li className="flex items-center gap-2">
          <svg aria-hidden="true" width="28" height="6"><line x1="0" y1="2" x2="28" y2="2" stroke={tok("border-strong")} /><line x1="0" y1="4" x2="28" y2="4" stroke={tok("border-strong")} /></svg>
          Meaning (reviewer hint)
        </li>
      )}
    </ul>
  )
}

export function NodePanel({ graph, id, threshold }: { graph: Graph; id: string | null; threshold: number }) {
  const node = graph.nodes.find((n) => n.id === id)
  if (!node) return <p className="text-sm text-lab-text-muted">Select a word to see what it merges with.</p>
  return (
    <section aria-label={`Details for ${node.label}`}>
      <h2 className="font-semibold">{node.label}</h2>
      <p className="text-sm text-lab-text-muted">{node.kind}, {plural(node.count, "submission")}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {edgesAt(graph, threshold).filter((e) => e.source === node.id || e.target === node.id).map((e) => {
          const other = graph.nodes.find((n) => n.id === (e.source === node.id ? e.target : e.source))!
          return (
            <li key={e.id}>
              {other.label} <span className="font-mono tabular-nums">{e.score.toFixed(2)}</span> {e.reason.replace("_", " ")}
              {e.signals && <span className="text-lab-text-muted"> ({`trigram ${e.signals.trigram.toFixed(2)}, ${e.signals.stem ? "stem match" : "no stem match"}`})</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ClusterTable({ graph, threshold }: { graph: Graph; threshold: number }) {
  const groups = clusters(graph, threshold)
  if (!groups.length) return <p className="text-sm text-lab-text-muted">No words are joined at this threshold.</p>
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Clusters of similar words at threshold {threshold.toFixed(2)}</caption>
      <thead><tr>{["Cluster", "Word", "Kind", "Submissions"].map((h) => <th key={h} scope="col" className="text-left">{h}</th>)}</tr></thead>
      <tbody>
        {groups.flatMap((g, i) => g.map((n) => (
          <tr key={n.id}><td>{i + 1}</td><td>{n.label}</td><td>{n.kind}</td><td>{n.count}</td></tr>
        )))}
      </tbody>
    </table>
  )
}
