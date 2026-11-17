import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import * as layout from "@/lib/dedup/layout"
const { layoutGraph } = layout
import type { Graph } from "@/lib/dedup/graph"

const n = (id: string, count: number) => ({ id, label: id, kind: "suggestion" as const, count })
const graph: Graph = {
  nodes: [n("a", 5), n("b", 1), n("c", 0), n("d", 4), n("e", 2)],
  edges: [
    { id: "a|b", source: "a", target: "b", score: 1, reason: "same_key" },
    { id: "d|e", source: "d", target: "e", score: 0.6, reason: "trigram", signals: { trigram: 0.6, stem: false } },
  ],
}
const size = { width: 640, height: 400 }

test("deterministic", () => {
  assert.deepEqual(layoutGraph(graph, size), layoutGraph(graph, size))
})

test("nodes finite and inside bounds", () => {
  const p = layoutGraph(graph, size)
  for (const { id } of graph.nodes) {
    const { x, y, r } = p[id]
    assert.ok(Number.isFinite(x) && Number.isFinite(y))
    assert.ok(x >= r && x <= size.width - r && y >= r && y <= size.height - r)
  }
})

test("radius grows with count, minimum 6", () => {
  const p = layoutGraph(graph)
  assert.ok(p.a.r > p.b.r && p.b.r > p.c.r && p.c.r >= 6)
})

test("no overlap", () => {
  const p = layoutGraph(graph)
  const ids = Object.keys(p)
  for (const i of ids) for (const j of ids) {
    if (i < j) assert.ok(Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y) >= p[i].r + p[j].r - 2, `${i}/${j}`)
  }
})

test("empty graph", () => {
  assert.deepEqual(layoutGraph({ nodes: [], edges: [] }), {})
})

test("labels stay inside the bounds (about 6.5px per char, 11px text drawn below the node)", () => {
  const many: Graph = { nodes: Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, label: `long label number ${i}`, kind: "suggestion" as const, count: i % 6 })), edges: [] }
  const p = layoutGraph(many, size)
  for (const { id, label } of many.nodes) {
    const { x, y, r } = p[id], half = (label.length * 6.5) / 2
    assert.ok(x - half >= 0 && x + half <= size.width, `${id} horizontal`)
    assert.ok(y + r + 16 <= size.height, `${id} below`)
  }
})


test("dragging a pinned node pulls its neighbour and release lets it settle", () => {
  const create = (layout as typeof layout & { graphSimulation: (graph: Graph, nodes: { id: string; x: number; y: number; r: number; fx?: number | null; fy?: number | null }[]) => { stop: () => any; alpha: (value: number) => any; tick: (count: number) => any } }).graphSimulation
  assert.equal(typeof create, "function")
  const pair: Graph = { nodes: [n("a", 1), n("b", 1)], edges: [{ id: "a|b", source: "a", target: "b", score: 1, reason: "same_key" }] }
  const nodes: { id: string; x: number; y: number; r: number; fx?: number | null; fy?: number | null }[] = [{ id: "a", x: 200, y: 200, r: 10, fx: 200, fy: 200 }, { id: "b", x: 280, y: 200, r: 10 }]
  const sim = create(pair, nodes).stop()
  nodes[0].fx = 100; nodes[0].fy = 100
  sim.alpha(1).tick(60)
  assert.equal(nodes[0].x, 100)
  assert.ok(nodes[1].x < 280, "linked node follows the drag")
  nodes[0].fx = null; nodes[0].fy = null
  sim.alpha(0.3).tick(60)
  assert.notEqual(nodes[0].x, 100, "released node settles")
})
