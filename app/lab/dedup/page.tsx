import { DedupTab } from "@/components/aura/dedup-tab"
import { DedupSearch } from "@/components/aura/dedup-search"
import { readDedupRows } from "@/lib/dedup/store"
import { searchCandidates } from "@/lib/dedup/search-demo"
import { listPublishedTermNames } from "@/lib/terms-store"
import { getDedupGraph, getDedupSavings, getSemanticEdges } from "../actions"

export const metadata = { title: "Dedup" }

export default async function DedupPage() {
  const candidates = searchCandidates(await readDedupRows(), await listPublishedTermNames())
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold">Dedup</h1>
        <p className="text-sm text-lab-muted">What normalisation and deduplication did to the suggestions, and which words the matcher joins.</p>
      </div>
      <DedupSearch candidates={candidates} />
      <DedupTab savingsAction={getDedupSavings} graphAction={getDedupGraph} semanticAction={getSemanticEdges} />
    </div>
  )
}
