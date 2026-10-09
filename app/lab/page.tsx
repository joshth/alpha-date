import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "Dashboard" }

const ROADMAP = [
  {
    title: "Input safety gate",
    detail: "Combine production's rules with a moderation endpoint, fail closed, refine the safeguarding panel.",
    where: "lib/safety/gate.ts",
  },
  {
    title: "Discovery evaluation harness",
    detail: "150+ labelled cases; precision, recall, hallucination rate and cost per run; measured improvement.",
    where: "scripts/eval.ts · eval/golden-set.json",
  },
  {
    title: "Suggestion normalisation & deduplication",
    detail: "Merge variant spellings; match suggestions to existing terms; triage view.",
    where: "lib/normalise",
  },
  {
    title: "Aura lifecycle scoring",
    detail: "Emerging / peaking / declining / parent territory from anonymous search trends; badge.",
    where: "lib/aura",
  },
]

export default function LabDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lexicon Lab</h1>
        <p className="text-muted-foreground">
          The lexicon pipeline: safety gate → lookup → AI discovery → human review.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2 className="text-lg">
                <Link href="/lab/search" className="hover:text-primary hover:underline">
                  Search the lexicon
                </Link>
              </h2>
            </CardTitle>
            <CardDescription>Runs the full pipeline for one input, starting with the safety gate.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2 className="text-lg">
                <Link href="/lab/review" className="hover:text-primary hover:underline">
                  Review queue
                </Link>
              </h2>
            </CardTitle>
            <CardDescription>AI-discovered terms awaiting review, and missing-term suggestions.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <section aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading" className="mb-3 text-lg font-semibold text-foreground">
          Project scope (to build)
        </h2>
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {ROADMAP.map((item) => (
                <li key={item.title}>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.detail} <code className="text-xs">{item.where}</code>
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
