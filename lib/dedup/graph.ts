import { findLikelyMatches, MATCH_THRESHOLD, type MatchReason } from "@/lib/normalise"

export type GraphNode = { id: string; label: string; kind: "suggestion" | "lexicon"; count: number }
export type GraphEdge = { id: string; source: string; target: string; score: number; reason: MatchReason; signals?: { trigram: number; stem: boolean } }
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] }

/** What the Dedup tab loads once: suggestion rows (text and count only), lexicon terms and the golden dedup cases. */
export type DedupGraphData = {
  rows: { suggestedTerm: string; count: number }[]
  lexicon: string[]
  golden: { input: string; candidate: string; sameTerm: boolean }[]
}

const key = (s: string) => s.trim().toLowerCase()

export function similarityGraph(rows: { suggestedTerm: string; count: number }[], lexicon: string[], threshold = MATCH_THRESHOLD): Graph {
  const byId = new Map<string, GraphNode>()
  for (const r of rows) {
    const id = key(r.suggestedTerm)
    const n = byId.get(id)
    if (n) n.count += r.count
    else byId.set(id, { id, label: r.suggestedTerm.trim(), kind: "suggestion", count: r.count })
  }
  for (const t of lexicon) if (!byId.has(key(t))) byId.set(key(t), { id: key(t), label: t.trim(), kind: "lexicon", count: 0 })
  const nodes = [...byId.values()]
  const edges = new Map<string, GraphEdge>()
  for (const a of nodes) {
    if (a.kind !== "suggestion") continue
    const others = nodes.filter((o) => o.id !== a.id).map((o) => o.id)
    for (const m of findLikelyMatches(a.id, others, others.length)) {
      if (m.score < threshold) continue
      const b = byId.get(m.candidate)!
      const id = [a.id, b.id].sort().join("|")
      const prev = edges.get(id)
      if (prev && prev.score >= m.score) continue
      const [source, target] = b.kind === "lexicon" || a.count >= b.count ? [a, b] : [b, a]
      edges.set(id, { id, source: source.id, target: target.id, score: m.score, reason: m.reason, ...(m.signals && { signals: m.signals }) })
    }
  }
  return { nodes, edges: [...edges.values()] }
}
