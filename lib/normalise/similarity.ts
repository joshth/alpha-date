// Copied from production (lib/db-only.ts, 2 Oct 2026). Production uses these
// for database-only lookups; reuse or extend them for suggestion matching.

// Lower-case, strip accents, drop everything but letters and digits, so
// "6-7", "6 7" and "67" (or "Touch-Grass" and "touch grass") share a key.
// Unicode-aware, so non-Latin input still yields a key.
export function normalizeKey(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "")
}

function trigrams(text: string): Set<string> {
  const padded = `  ${text} `
  const grams = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3))
  return grams
}

// Jaccard similarity of character trigrams (the measure pg_trgm uses).
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a)
  const tb = trigrams(b)
  let shared = 0
  for (const g of ta) if (tb.has(g)) shared++
  const union = ta.size + tb.size - shared
  return union === 0 ? 0 : shared / union
}
