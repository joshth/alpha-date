// URL slug for a slang term: "It's giving" -> "its-giving".
export function termToSlug(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}
