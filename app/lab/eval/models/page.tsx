import { ModelReportsPanel } from "@/components/lab/model-reports-panel"
import { loadModelReports } from "@/lib/eval/saved-reports"

export const metadata = { title: "Model reports" }

// Read-only view of the newest saved sweep report: no model is called here.
export default async function ModelReportsPage({ searchParams }: { searchParams: Promise<{ model?: string | string[] }> }) {
  const [loaded, params] = await Promise.all([loadModelReports(), searchParams])
  if (!loaded.ok) {
    return (
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold">Model reports</h1>
        <p role="status" className="text-sm text-lab-muted">{loaded.reason}</p>
      </div>
    )
  }
  const model = Array.isArray(params.model) ? params.model[0] : params.model
  return <ModelReportsPanel reports={loaded.reports} initialModel={model} />
}
