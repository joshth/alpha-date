import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force"
import type { Graph } from "./graph"

type Pos = { x: number; y: number; r: number }

export function layoutGraph(graph: Graph, size = { width: 640, height: 400 }): Record<string, Pos> {
  const { width, height } = size
  const nodes = graph.nodes.map((n, i) => ({ id: n.id, r: Math.min(28, 6 + 4 * Math.sqrt(n.count)), x: width / 2 + Math.cos(i) * 10, y: height / 2 + Math.sin(i) * 10 }))
  const links = graph.edges.map((e) => ({ source: e.source, target: e.target, score: e.score }))
  const sim = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-60))
    .force("link", forceLink(links).id((d) => (d as { id: string }).id).distance(80).strength((l) => (l as { score: number }).score * 0.5))
    .force("collide", forceCollide<(typeof nodes)[number]>((d) => d.r + 4))
    .force("center", forceCenter(width / 2, height / 2))
    .force("x", forceX(width / 2).strength(0.05))
    .force("y", forceY(height / 2).strength(0.05))
    .stop()
  // ponytail: fixed 300 ticks, fine up to ~200 nodes; cap or batch beyond that
  sim.tick(300)
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const label = new Map(graph.nodes.map((n) => [n.id, n.label.length]))
  // Keep the centred 11px label (about 6.5px per char, drawn 16px below the node) inside the bounds too.
  return Object.fromEntries(nodes.map((n) => {
    const side = Math.max(n.r, (label.get(n.id)! * 6.5) / 2)
    return [n.id, { x: clamp(n.x, side, width - side), y: clamp(n.y, n.r, height - n.r - 16), r: n.r }]
  }))
}
