"use client"

import { useEffect, useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { ClusterTable, GraphLegend, GraphView, NodePanel } from "@/components/aura/similarity-graph"
import { similarityGraph, type DedupGraphData, type Graph } from "@/lib/dedup/graph"
import type { SemanticEdge } from "@/lib/dedup/semantic"
import { layoutGraph } from "@/lib/dedup/layout"
import { mergeCount, nextNeighbour } from "@/lib/dedup/nav"
import { mergeQuality } from "@/lib/dedup/threshold"
import { MATCH_THRESHOLD } from "@/lib/normalise"

type Pos = { x: number; y: number; r: number }
type Quality = { precision: number | null; recall: number | null; cases: number } | null
type Key = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"

export const defaultShowTable = (viewportWidth: number) => viewportWidth < 768

const fmt = (n: number | null) => (n === null ? "n/a" : n.toFixed(2))

export function GraphExplorerView({ graph, positions, threshold, onThreshold, selectedId, showTable, onToggleTable, quality, onSelect, onMove, semanticOn, onToggleSemantic, semanticEdges }: {
  graph: Graph; positions: Record<string, Pos>; threshold: number; onThreshold?: (n: number) => void; selectedId: string | null
  semanticOn?: boolean; onToggleSemantic?: () => void; semanticEdges?: SemanticEdge[]
  showTable: boolean; onToggleTable?: () => void; quality: Quality; onSelect?: (id: string) => void; onMove?: (key: Key) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Slider min={0.3} max={1} step={0.01} value={[threshold]} aria-label="Match threshold" onValueChange={([v]) => onThreshold?.(v)} />
          <output className="font-mono tabular-nums text-sm">{threshold.toFixed(2)}</output>
        </div>
        <p aria-live="polite" className="text-sm">{mergeCount(graph, threshold)} merges at this threshold</p>
        <p className="text-xs text-lab-muted">Changing the threshold never changes stored data.</p>
        <p className="text-xs text-lab-muted">{quality ? `Merge precision ${fmt(quality.precision)} · recall ${fmt(quality.recall)} on ${quality.cases} golden cases` : "No golden dedup cases loaded."}</p>
        <button type="button" aria-pressed={showTable} onClick={onToggleTable} className="h-9 rounded border border-lab-border-strong px-3 text-sm">Show as table</button>
        <button type="button" aria-pressed={!!semanticOn} onClick={onToggleSemantic} className="ml-2 h-9 rounded border border-lab-border-strong px-3 text-sm">Show meaning matches</button>
        <p className="text-xs text-lab-muted">Meaning matches are hints for a reviewer. They never merge rows.</p>
      </div>
      {showTable ? <ClusterTable graph={graph} threshold={threshold} /> : (
        <div className="space-y-3">
          <GraphView graph={graph} positions={positions} selectedId={selectedId} threshold={threshold} onSelect={onSelect} onMove={onMove} semanticEdges={semanticOn ? semanticEdges : undefined} />
          <GraphLegend semantic={semanticOn} />
          <NodePanel graph={graph} id={selectedId} threshold={threshold} />
        </div>
      )}
    </div>
  )
}

export function GraphExplorer({ graphAction, semanticAction }: { graphAction: () => Promise<DedupGraphData>; semanticAction?: () => Promise<SemanticEdge[]> }) {
  const [semanticOn, setSemanticOn] = useState(false)
  const [semantic, setSemantic] = useState<SemanticEdge[] | null>(null)
  const toggleSemantic = () => {
    if (!semanticOn && !semantic && semanticAction) semanticAction().then(setSemantic, () => setSemantic([]))
    setSemanticOn((v) => !v)
  }
  const [data, setData] = useState<DedupGraphData | null>(null)
  const [threshold, setThreshold] = useState(MATCH_THRESHOLD)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)
  useEffect(() => {
    setShowTable(defaultShowTable(window.innerWidth))
    graphAction().then(setData)
  }, [graphAction])
  // Built once at the lowest slider value; the slider only filters edges, so nodes never move.
  const graph = useMemo(() => (data ? similarityGraph(data.rows, data.lexicon, 0.3) : null), [data])
  const positions = useMemo(() => (graph ? layoutGraph(graph) : {}), [graph])
  if (!data || !graph) return <Skeleton className="h-64" />
  if (!data.rows.length) return <p className="text-sm text-lab-muted">No suggestions to graph yet.</p>
  const quality = data.golden.length ? { ...mergeQuality(data.golden, threshold), cases: data.golden.length } : null
  const onMove = (key: Key) => {
    const id = selectedId ? nextNeighbour(graph, positions, selectedId, key) : null
    if (!id) return
    setSelectedId(id)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus())
  }
  return <GraphExplorerView graph={graph} positions={positions} threshold={threshold} onThreshold={setThreshold} selectedId={selectedId} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} quality={quality} onSelect={setSelectedId} onMove={onMove} semanticOn={semanticOn} onToggleSemantic={toggleSemantic} semanticEdges={semantic ?? undefined} />
}
