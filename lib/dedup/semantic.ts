import type { Graph } from "./graph"

/** Cosine >= 0.85 counts as "close in meaning". Reviewer hint only: semantic edges never merge rows. */
export const SEMANTIC_CUTOFF = 0.85

export type SemanticEdge = { id: string; source: string; target: string; score: number; reason: "semantic" }

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vectors must have equal length")
  let dot = 0, na = 0, nb = 0
  a.forEach((x, i) => { dot += x * b[i]; na += x * x; nb += b[i] * b[i] })
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}

export function semanticEdges(graph: Graph, vectors: Record<string, number[]>, cutoff = SEMANTIC_CUTOFF): SemanticEdge[] {
  const lexical = new Set(graph.edges.map((e) => e.id))
  const nodes = graph.nodes.filter((n) => vectors[n.id])
  const out: SemanticEdge[] = []
  nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => {
    const id = [a.id, b.id].sort().join("|")
    const score = cosine(vectors[a.id], vectors[b.id])
    if (lexical.has(id) || score < cutoff) return
    const [s, t] = b.count > a.count ? [b, a] : [a, b]
    out.push({ id, source: s.id, target: t.id, score, reason: "semantic" })
  }))
  return out.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
}
