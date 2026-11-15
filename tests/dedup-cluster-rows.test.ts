import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { CLUSTER_COLUMNS, clusterRows, clusters } from "@/lib/dedup/nav"
import type { Graph } from "@/lib/dedup/graph"

const node = (id: string, count: number, kind: "suggestion" | "lexicon" = "suggestion") => ({ id, label: id, kind, count })
const edge = (s: string, t: string, score: number) => ({ id: [s, t].sort().join("|"), source: s, target: t, score, reason: "trigram" as const, signals: { trigram: score, stem: false } })
const graph: Graph = {
  nodes: [node("a", 5), node("b", 2), node("c", 0, "lexicon"), node("x", 3), node("y", 1)],
  edges: [edge("a", "b", 0.9), edge("a", "c", 0.6), edge("x", "y", 0.7)],
}

test("columns", () => assert.deepEqual(CLUSTER_COLUMNS, [
  { key: "cluster", label: "Cluster" }, { key: "word", label: "Word" }, { key: "kind", label: "Kind" }, { key: "submissions", label: "Submissions", numeric: true },
]))

test("flattened in clusters() order, 1-based numbering", () => {
  const expected = clusters(graph, 0.5).flatMap((c, i) => c.map((n) => ({ cluster: i + 1, word: n.label, kind: n.kind, submissions: n.count })))
  assert.equal(expected.length, 5)
  assert.deepEqual(clusterRows(graph, 0.5), expected)
  assert.equal(clusterRows(graph, 0.5)[0].cluster, 1)
  assert.equal(clusterRows(graph, 0.5).at(-1)!.cluster, 2)
})

test("empty graph and threshold filtering", () => {
  assert.deepEqual(clusterRows({ nodes: [], edges: [] }, 0.5), [])
  assert.deepEqual(clusterRows(graph, 0.65).map((r) => r.word).sort(), ["a", "b", "x", "y"])
  assert.deepEqual(clusterRows(graph, 0.8).map((r) => r.word).sort(), ["a", "b"])
  assert.deepEqual(clusterRows(graph, 0.95), [])
})
