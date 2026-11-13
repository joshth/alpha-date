import { searchTerm } from "@/app/lab/actions"

// Same safety-gated pipeline as the Lexicon Lab search box.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim()
  if (!q) return Response.json({ error: "Query parameter q is required." }, { status: 400 })
  return Response.json(await searchTerm(q))
}
