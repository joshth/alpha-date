"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { ExportMenu } from "@/components/aura/export-menu"
import { GraphInfoButton } from "@/components/aura/graph-info"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { ClusterTable, GraphLegend, GraphView, NodePanel } from "@/components/aura/similarity-graph"
import { similarityGraph, type DedupGraphData, type Graph } from "@/lib/dedup/graph"
import type { SemanticEdge } from "@/lib/dedup/semantic"
import { layoutGraph } from "@/lib/dedup/layout"
import { CLUSTER_COLUMNS, clusterRows, mergeCount, nextNeighbour } from "@/lib/dedup/nav"
import { mergeQuality } from "@/lib/dedup/threshold"
import { fullView, panView, screenToGraph, zoomView, type View } from "@/lib/dedup/zoom"
import { MATCH_THRESHOLD } from "@/lib/normalise"

const BASE = { width: 640, height: 400 }
const ZOOM_STEP = 1.5

type Pos = { x: number; y: number; r: number }
type Quality = { precision: number | null; recall: number | null; cases: number } | null
type Key = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"

export const defaultShowTable = (viewportWidth: number) => viewportWidth < 768

const fmt = (n: number | null) => (n === null ? "n/a" : n.toFixed(2))

export function GraphExplorerView({ graph, positions, threshold, onThreshold, selectedId, showTable, onToggleTable, quality, onSelect, onMove, semanticOn, onToggleSemantic, semanticEdges, view, onZoom, onResetZoom, onPan }: {
  graph: Graph; positions: Record<string, Pos>; threshold: number; onThreshold?: (n: number) => void; selectedId: string | null
  view?: View; onZoom?: (factor: number, cx?: number, cy?: number) => void; onResetZoom?: () => void; onPan?: (dx: number, dy: number) => void
  semanticOn?: boolean; onToggleSemantic?: () => void; semanticEdges?: SemanticEdge[]
  showTable: boolean; onToggleTable?: () => void; quality: Quality; onSelect?: (id: string) => void; onMove?: (key: Key) => void
}) {
  const graphRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const getSvg = () => graphRef.current?.querySelector<SVGSVGElement>('svg[aria-label="Similarity graph"]') ?? null
  const zoomed = !!view && view.w < BASE.width
  // Ctrl/⌘+wheel (and trackpad pinch, which browsers send as ctrl+wheel) zooms about the pointer; a plain wheel still scrolls the page.
  // React's onWheel is passive, so preventDefault needs a native listener.
  useEffect(() => {
    const el = graphRef.current, svg = getSvg()
    if (!el || !svg || !view || !onZoom) return
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const p = screenToGraph(view, svg.getBoundingClientRect(), e.clientX, e.clientY)
      onZoom(Math.exp(-e.deltaY * 0.01), p.x, p.y)
    }
    el.addEventListener("wheel", wheel, { passive: false })
    return () => el.removeEventListener("wheel", wheel)
  }, [view, onZoom, showTable])
  const panStart = (e: PointerEvent<HTMLDivElement>) => { if (zoomed && e.button === 0) drag.current = { x: e.clientX, y: e.clientY, moved: false } }
  const panMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current, svg = getSvg()
    if (!d || !svg || !view || !onPan) return
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId) // only after a real drag, so node clicks still work
    d.moved = true
    const rect = svg.getBoundingClientRect()
    onPan((-e.movementX / rect.width) * view.w, (-e.movementY / rect.height) * view.h)
  }
  const panEnd = () => { if (drag.current && !drag.current.moved) drag.current = null }
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
        <GraphInfoButton id="similarity" />
        <ExportMenu filename="similarity-clusters" columns={CLUSTER_COLUMNS} rows={clusterRows(graph, threshold)} getSvg={showTable ? undefined : getSvg} />
        <button type="button" aria-pressed={showTable} onClick={onToggleTable} className="ml-2 h-9 rounded border border-lab-border-strong px-3 text-sm">Show as table</button>
        <button type="button" aria-pressed={!!semanticOn} onClick={onToggleSemantic} className="ml-2 h-9 rounded border border-lab-border-strong px-3 text-sm">Show meaning matches</button>
        <p className="text-xs text-lab-muted">Meaning matches are hints for a reviewer. They never merge rows.</p>
      </div>
      {showTable ? <ClusterTable graph={graph} threshold={threshold} /> : (
        <div className="space-y-3">
          <div className="flex gap-2">
            {([["Zoom in", "+", ZOOM_STEP], ["Zoom out", "−", 1 / ZOOM_STEP]] as const).map(([name, glyph, f]) => (
              <button key={name} type="button" aria-label={name} onClick={() => onZoom?.(f)} className="h-9 w-9 rounded border border-lab-border-strong text-lg">{glyph}</button>
            ))}
            <button type="button" aria-label="Reset zoom" onClick={onResetZoom} className="h-9 rounded border border-lab-border-strong px-3 text-sm">Reset</button>
          </div>
          <div ref={graphRef} onPointerDown={panStart} onPointerMove={panMove} onPointerUp={panEnd} onPointerCancel={panEnd}
            onClickCapture={(e) => { if (drag.current?.moved) { e.stopPropagation(); drag.current = null } }}
            className={zoomed ? "cursor-grab touch-none active:cursor-grabbing" : undefined}><GraphView graph={graph} positions={positions} view={view} selectedId={selectedId} threshold={threshold} onSelect={onSelect} onMove={onMove} semanticEdges={semanticOn ? semanticEdges : undefined} /></div>
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
  const [view, setView] = useState<View>(fullView(BASE))
  const zoom = (factor: number, cx?: number, cy?: number) => setView((v) => zoomView(v, BASE, factor, cx ?? v.x + v.w / 2, cy ?? v.y + v.h / 2))
  const pan = (dx: number, dy: number) => setView((v) => panView(v, BASE, dx, dy))
  useEffect(() => {
    setShowTable(defaultShowTable(window.innerWidth))
    graphAction().then(setData)
  }, [graphAction])
  // Built once at the lowest slider value; the slider only filters edges, so nodes never move.
  const graph = useMemo(() => (data ? similarityGraph(data.rows, data.lexicon, 0.3) : null), [data])
  const positions = useMemo(() => (graph ? layoutGraph(graph) : {}), [graph])
  if (!data || !graph) return <div role="status" aria-label="Loading similarity graph"><span className="sr-only">Loading similarity graph…</span><Skeleton className="h-64 w-full" /></div>
  if (!data.rows.length) return <p className="text-sm text-lab-muted">No suggestions to graph yet.</p>
  const quality = data.golden.length ? { ...mergeQuality(data.golden, threshold), cases: data.golden.length } : null
  const onMove = (key: Key) => {
    const id = selectedId ? nextNeighbour(graph, positions, selectedId, key) : null
    if (!id) return
    setSelectedId(id)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus())
  }
  return <GraphExplorerView graph={graph} positions={positions} threshold={threshold} onThreshold={setThreshold} selectedId={selectedId} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} quality={quality} onSelect={setSelectedId} onMove={onMove} semanticOn={semanticOn} onToggleSemantic={toggleSemantic} semanticEdges={semantic ?? undefined} view={view} onZoom={zoom} onPan={pan} onResetZoom={() => setView(fullView(BASE))} />
}
