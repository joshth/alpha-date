import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { SEMANTIC_CUTOFF, cosine, semanticEdges } from "@/lib/dedup/semantic"
import { mergeCount } from "@/lib/dedup/nav"

const node = (id: string, count: number) => ({ id, label: id, kind: "suggestion" as const, count })
const graph = {
  nodes: [node("a", 5), node("b", 3), node("c", 2), node("d", 1), node("e", 1)],
  edges: [{ id: "c|d", source: "c", target: "d", score: 0.7, reason: "trigram" as const }],
}
const vectors = { a: [1, 0], b: [1, 0.1], c: [0, 1], d: [0.1, 1] } // e has no vector

test("cosine basics", () => {
  assert.equal(SEMANTIC_CUTOFF, 0.85)
  assert.equal(cosine([1, 2], [1, 2]).toFixed(6), "1.000000")
  assert.equal(cosine([1, 0], [0, 1]), 0)
  assert.equal(cosine([1, 2], [10, 20]).toFixed(6), "1.000000")
  assert.equal(cosine([0, 0], [1, 2]), 0)
  assert.throws(() => cosine([1], [1, 2]))
})

test("edge for a pair above the cutoff only; lexical pairs and vector-less nodes are skipped", () => {
  const es = semanticEdges(graph, vectors)
  assert.deepEqual(es.map((e) => e.id), ["a|b"])
  assert.equal(es[0].source, "a")
  assert.equal(es[0].target, "b")
  assert.equal(es[0].reason, "semantic")
  assert.ok(es[0].score >= SEMANTIC_CUTOFF)
  assert.ok(!es.some((e) => e.id.includes("e")))
})

test("a higher cutoff removes edges", () => assert.deepEqual(semanticEdges(graph, vectors, 0.999), []))

test("never mutates the graph or changes merge counts", () => {
  const before = JSON.stringify(graph)
  const merges = mergeCount(graph, 0.5)
  semanticEdges(graph, vectors)
  assert.equal(JSON.stringify(graph), before)
  assert.equal(mergeCount(graph, 0.5), merges)
})
