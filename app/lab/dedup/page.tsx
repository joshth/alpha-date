import { DedupTab } from "@/components/aura/dedup-tab"
import { DedupSearch } from "@/components/aura/dedup-search"
import { listPublishedTermNames } from "@/lib/terms-store"
import { getDedupGraph, getDedupSavings, getSemanticEdges } from "../actions"

export const metadata = { title: "Dedup" }

// Always offered in the search box so the demo works on an empty lexicon.
const DEMO_TERMS = ["六七", "brainrot", "skibidi", "gyatt"]

export default async function DedupPage() {
  const candidates = [...new Set([...DEMO_TERMS, ...(await listPublishedTermNames())])]
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
