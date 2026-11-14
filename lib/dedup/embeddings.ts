// Hand-made 4-d "meaning axes" vectors for mock mode. Illustrative data, not real embeddings.
export const MEANING_FIXTURE: Record<string, number[]> = {
  rizzler: [1, 0.2, 0, 0],
  huzz: [0.9, 0.3, 0, 0],
  gyatt: [0, 0, 1, 0.1],
  tuff: [0, 0, 0.9, 0.2],
  chopped: [0.3, 0, 0.3, 0.9],
  "brain rot": [0, 1, 0, 0.3],
  skibidy: [0.1, 0.9, 0, 0.4],
  zorbleflux: [0, 0, 0.1, 1],
  asdfgh: [0, 0.1, 0, 1],
}

type Embed = (words: string[]) => Promise<number[][]>

export function createEmbedder({ mock, embed }: { mock: boolean; embed?: Embed }) {
  return async (words: string[]): Promise<Record<string, number[]>> => {
    const keys = [...new Set(words.map((w) => w.trim().toLowerCase()))]
    if (mock) return Object.fromEntries(keys.filter((k) => k in MEANING_FIXTURE).map((k) => [k, MEANING_FIXTURE[k]]))
    if (!embed) throw new Error("Embedding service not configured")
    const vectors = await embed(keys)
    return Object.fromEntries(keys.map((k, i) => [k, vectors[i]]))
  }
}
