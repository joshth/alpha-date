import { LifecycleTab } from "@/components/aura/lifecycle-tab"
import { fitAuraTerm, getAuraDashboardRows } from "../actions"

export const metadata = { title: "Aura" }

type AuraSearchParams = { [key: string]: string | string[] | undefined }

export default async function AuraPage({ searchParams }: { searchParams: Promise<AuraSearchParams> }) {
  const params = await searchParams
  const term = params.term
  const initialTerm = Array.isArray(term) ? term[0] ?? "" : term ?? ""
  const rows = await getAuraDashboardRows()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold">Aura</h1>
        <p className="text-sm text-lab-muted">Where a term sits in its lifecycle, from a SIRS fit to search interest.</p>
      </div>
      <LifecycleTab fitAction={fitAuraTerm} initialTerm={initialTerm} dashboardRows={rows} />
    </div>
  )
}
