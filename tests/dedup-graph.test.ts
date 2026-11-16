import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { similarityGraph } from "@/lib/dedup/graph"
import { findLikelyMatches, MATCH_THRESHOLD } from "@/lib/normalise"

const rows = [
  { suggestedTerm: "brainrot", count: 5 }, { suggestedTerm: "brain rot", count: 2 },
  { suggestedTerm: "brainrottt", count: 1 }, { suggestedTerm: "mid", count: 4 },
  { suggestedTerm: "rizzler", count: 1 }, { suggestedTerm: "rizz", count: 3 },
]
const g = similarityGraph(rows, ["rizz", "mid", "skibidi"])
const edge = (a: string, b: string) => g.edges.find((e) => e.id === [a, b].sort().join("|"))
const node = (id: string) => g.nodes.filter((n) => n.id === id)

test("same_key edge between brain rot and brainrot", () => {
  const e = edge("brain rot", "brainrot")
  assert.equal(e?.reason, "same_key")
  assert.equal(e?.score, 1)
  assert.equal(e?.source, "brainrot")
})

test("over-merge risk is visible: rizz and rizzler are joined by a stem match", () => {
  const m = findLikelyMatches("rizz", ["rizzler"])[0]
  assert.ok(m && m.score >= MATCH_THRESHOLD)
  assert.equal(edge("rizz", "rizzler")?.score, m.score)
  assert.equal(edge("rizz", "rizzler")?.reason, "stem")
})

test("short keys are never fuzzy-matched, so mid and midd stay apart", () => {
  const short = similarityGraph([{ suggestedTerm: "mid", count: 4 }, { suggestedTerm: "midd", count: 1 }], [])
  assert.equal(short.edges.length, 0)
})

test("suggestion and lexicon term share one node; skibidi isolated", () => {
  assert.equal(node("rizz").length, 1)
  assert.deepEqual([node("rizz")[0].kind, node("rizz")[0].count], ["suggestion", 3])
  const s = node("skibidi")[0]
  assert.deepEqual([s.kind, s.count], ["lexicon", 0])
  assert.ok(!g.edges.some((e) => e.source === "skibidi" || e.target === "skibidi"))
  assert.equal(g.nodes.length, 7)
})

test("no self or duplicate edges, signals on trigram/stem", () => {
  assert.equal(new Set(g.edges.map((e) => e.id)).size, g.edges.length)
  assert.ok(g.edges.every((e) => e.source !== e.target && e.score >= MATCH_THRESHOLD))
  for (const e of g.edges) assert.equal(e.reason === "same_key", e.signals === undefined)
  assert.ok(g.edges.some((e) => e.signals))
})

test("higher threshold keeps only strong edges", () => {
  const hi = similarityGraph(rows, ["rizz", "mid", "skibidi"], 0.9)
  assert.ok(hi.edges.length > 0 && hi.edges.length < g.edges.length)
  assert.ok(hi.edges.every((e) => e.score >= 0.9))
  assert.equal(hi.nodes.length, g.nodes.length)
})
