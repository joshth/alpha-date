export function auraTermPath(term: string): string {
  return `/lab/aura/${encodeURIComponent(term.trim())}`
}

export function decodeAuraTerm(term: string): string {
  try {
    return decodeURIComponent(term)
  } catch {
    return term
  }
}
