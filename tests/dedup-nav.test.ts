import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { clusters, edgesAt, mergeCount, nextNeighbour } from "@/lib/dedup/nav"
import type { Graph } from "@/lib/dedup/graph"

const node = (id: string, count: number, kind: "suggestion" | "lexicon" = "suggestion") => ({ id, label: id, kind, count })
const edge = (s: string, t: string, score: number) => ({ id: [s, t].sort().join("|"), source: s, target: t, score, reason: "trigram" as const, signals: { trigram: score, stem: false } })
const graph: Graph = {
  nodes: [node("a", 5), node("b", 2), node("c", 0, "lexicon"), node("d", 1)],
  edges: [edge("a", "b", 0.9), edge("a", "c", 0.6), edge("a", "d", 0.55)],
}
const pos = { a: { x: 100, y: 100, r: 10 }, b: { x: 200, y: 110, r: 8 }, c: { x: 90, y: 20, r: 6 }, d: { x: 150, y: 105, r: 6 } }

test("edgesAt filters by score", () => {
  assert.deepEqual(edgesAt(graph, 0.5).length, 3)
  assert.deepEqual(edgesAt(graph, 0.6).map((e) => e.id), ["a|b", "a|c"])
  assert.deepEqual(edgesAt(graph, 0.95), [])
})

test("mergeCount counts suggestion-suggestion pairs only", () => {
  assert.equal(mergeCount(graph, 0.5), 2)
  assert.equal(mergeCount(graph, 0.6), 1)
  assert.equal(mergeCount(graph, 0.95), 0)
})

test("clusters are components of 2+ nodes, sorted", () => {
  assert.deepEqual(clusters(graph, 0.5).map((c) => c.map((n) => n.id)), [["a", "b", "d", "c"]])
  assert.deepEqual(clusters(graph, 0.6).map((c) => c.map((n) => n.id)), [["a", "b", "c"]])
  assert.deepEqual(clusters(graph, 0.95), [])
})

test("nextNeighbour picks nearest connected node in direction", () => {
  assert.equal(nextNeighbour(graph, pos, "a", "ArrowRight"), "d")
  assert.equal(nextNeighbour(graph, pos, "a", "ArrowUp"), "c")
  assert.equal(nextNeighbour(graph, pos, "a", "ArrowLeft"), null)
  assert.equal(nextNeighbour(graph, pos, "a", "ArrowDown"), null)
  assert.equal(nextNeighbour(graph, pos, "b", "ArrowLeft"), "a")
  assert.equal(nextNeighbour(graph, pos, "c", "ArrowRight"), null)
})
