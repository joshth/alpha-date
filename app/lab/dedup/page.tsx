import { DedupTab } from "@/components/aura/dedup-tab"
import { getDedupGraph, getDedupSavings, getSemanticEdges } from "../actions"

export const metadata = { title: "Dedup" }

export default function DedupPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold">Dedup</h1>
        <p className="text-sm text-lab-muted">What normalisation and deduplication did to the suggestions, and which words the matcher joins.</p>
      </div>
      <DedupTab savingsAction={getDedupSavings} graphAction={getDedupGraph} semanticAction={getSemanticEdges} />
    </div>
  )
}
