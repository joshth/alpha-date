import { LifecycleTab } from "@/components/aura/lifecycle-tab"
import { fitAuraTerm } from "../../actions"

export default async function AuraTermPage({ params }: { params: Promise<{ term: string }> }) {
  const { term } = await params
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold">Aura</h1>
        <p className="text-sm text-lab-muted">Where a term sits in its lifecycle, from a SIRS fit to search interest.</p>
      </div>
      <LifecycleTab fitAction={fitAuraTerm} initialTerm={term} />
    </div>
  )
}
