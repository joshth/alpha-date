import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ReviewButtons } from "@/components/review/review-buttons"
import { listSuggestions } from "@/lib/feedback"
import { listTermsByStatus } from "@/lib/terms-store"

export const metadata = { title: "Review queue" }

// Baseline review queue (adapted from production /educator/moderation).
// The suggestions table is the starting point for your triage view: today it
// lists exact-match rows only, so variants of one term appear separately.

export default async function ReviewPage() {
  const [pending, suggestions] = await Promise.all([listTermsByStatus("pending_review"), listSuggestions()])

  return (
    <div className="space-y-10">
      <section aria-labelledby="pending-heading" className="space-y-4">
        <div>
          <h1 id="pending-heading" className="text-2xl font-bold text-foreground">
            Review queue
          </h1>
          <p className="text-muted-foreground">
            AI-discovered terms wait here before entering the shared lexicon. Publishing makes a term visible to
            everyone; rejecting hides it permanently.
          </p>
        </div>
        {pending.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">Nothing awaiting review.</CardContent>
          </Card>
        )}
        {pending.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <CardTitle asChild>
                <h2 className="text-lg">{record.term.term}</h2>
              </CardTitle>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={record.term.sensitivityRating === "Generally Harmless" ? "secondary" : "destructive"}>
                  {record.term.sensitivityRating}
                </Badge>
                <Badge variant="outline">{record.source}</Badge>
                <Badge variant="outline">{new Date(record.createdAt).toLocaleDateString("en-AU")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="leading-relaxed text-foreground/90">{record.term.definition}</p>
              <ReviewButtons termId={record.id} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="suggestions-heading" className="space-y-4">
        <div>
          <h2 id="suggestions-heading" className="text-xl font-bold text-foreground">
            Missing-term suggestions
          </h2>
          <p className="text-muted-foreground">Sorted by how often each was suggested. Exact matches only (baseline).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Pending missing-term suggestions</caption>
            <thead className="border-b text-foreground">
              <tr>
                <th scope="col" className="py-2 pr-4">Suggestion</th>
                <th scope="col" className="py-2 pr-4">Count</th>
                <th scope="col" className="py-2 pr-4">Context</th>
                <th scope="col" className="py-2">First seen</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium text-foreground">{s.suggestedTerm}</td>
                  <td className="py-2 pr-4 text-foreground">{s.count}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{s.context ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
