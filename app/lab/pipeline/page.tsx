import { PipelinePanel } from "@/components/lab/pipeline-panel"

export const metadata = { title: "Pipeline" }

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Search to stored term</h1>
        <p className="text-muted-foreground">
          One search, four stages: safety gate, lexicon lookup, AI discovery, store for review.
        </p>
      </div>
      <PipelinePanel />
    </div>
  )
}
