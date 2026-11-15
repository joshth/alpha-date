import { EvalPanel } from "@/components/lab/eval-panel"
import { getBuckets } from "./actions"

export const metadata = { title: "Discovery evaluation" }

export default async function EvalPage() {
  const info = await getBuckets()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discovery evaluation</h1>
        <p className="text-muted-foreground">
          Run the answer key through the safety gate and the discovery AI, then see where the AI is wrong.
        </p>
      </div>
      <EvalPanel info={info} />
    </div>
  )
}
