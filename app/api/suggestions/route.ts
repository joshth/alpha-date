import { suggestTerm } from "@/app/lab/actions"

// Same screened flow as the Lexicon Lab "suggest a term" form.
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object." }, { status: 400 })
  }
  const { term, context } = body as Record<string, unknown>
  // suggestTerm validates both fields; anything that isn't a string fails its checks.
  const result = await suggestTerm(typeof term === "string" ? term : "", context as string | undefined)
  return Response.json(result, { status: result.success ? 201 : 400 })
}
