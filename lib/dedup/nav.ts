import type { Graph, GraphEdge, GraphNode } from "./graph"

export const edgesAt = (g: Graph, threshold: number): GraphEdge[] => g.edges.filter((e) => e.score >= threshold)

export function mergeCount(g: Graph, threshold: number): number {
  const kind = new Map(g.nodes.map((n) => [n.id, n.kind]))
  return edgesAt(g, threshold).filter((e) => kind.get(e.source) === "suggestion" && kind.get(e.target) === "suggestion").length
}

export function clusters(g: Graph, threshold: number): GraphNode[][] {
  const parent = new Map(g.nodes.map((n) => [n.id, n.id]))
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!))
  for (const e of edgesAt(g, threshold)) parent.set(find(e.source), find(e.target))
  const groups = new Map<string, GraphNode[]>()
  for (const n of g.nodes) groups.set(find(n.id), [...(groups.get(find(n.id)) ?? []), n])
  const byCount = (a: GraphNode, b: GraphNode) => b.count - a.count || a.label.localeCompare(b.label)
  return [...groups.values()].filter((c) => c.length >= 2).map((c) => c.sort(byCount))
    .sort((a, b) => b.length - a.length || a[0].label.localeCompare(b[0].label))
}

export const CLUSTER_COLUMNS = [
  { key: "cluster", label: "Cluster" }, { key: "word", label: "Word" }, { key: "kind", label: "Kind" }, { key: "submissions", label: "Submissions", numeric: true },
]

export const clusterRows = (g: Graph, threshold: number) =>
  clusters(g, threshold).flatMap((c, i) => c.map((n) => ({ cluster: i + 1, word: n.label, kind: n.kind, submissions: n.count })))

export function nextNeighbour(g: Graph, pos: Record<string, { x: number; y: number }>, id: string, key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"): string | null {
  const from = pos[id]
  let best: string | null = null
  let bestD = Infinity
  for (const e of g.edges) {
    const other = e.source === id ? e.target : e.target === id ? e.source : null
    if (!other || !pos[other]) continue
    const dx = pos[other].x - from.x
    const dy = pos[other].y - from.y
    const ok = key === "ArrowRight" ? dx > Math.abs(dy) : key === "ArrowLeft" ? -dx > Math.abs(dy) : key === "ArrowDown" ? dy > Math.abs(dx) : -dy > Math.abs(dx)
    if (ok && Math.hypot(dx, dy) < bestD) [best, bestD] = [other, Math.hypot(dx, dy)]
  }
  return best
}
