import { AuraDashboardTable, LifecycleTab } from "@/components/aura/lifecycle-tab"
import { fitAuraTerm, getAuraDashboardRows } from "../actions"

export const metadata = { title: "Aura" }

export default async function AuraPage() {
  const rows = await getAuraDashboardRows()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold">Aura</h1>
        <p className="text-sm text-lab-muted">Where a term sits in its lifecycle, from a SIRS fit to search interest.</p>
      </div>
      <AuraDashboardTable rows={rows} />
      <LifecycleTab fitAction={fitAuraTerm} />
    </div>
  )
}
