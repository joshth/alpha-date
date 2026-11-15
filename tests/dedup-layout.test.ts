import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { layoutGraph } from "@/lib/dedup/layout"
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
