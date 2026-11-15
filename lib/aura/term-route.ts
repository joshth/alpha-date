export function auraTermPath(term: string): string {
  return `/lab/aura/${encodeURIComponent(term.trim())}`
}
