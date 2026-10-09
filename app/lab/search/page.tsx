import { SearchPanel } from "@/components/search/search-panel"

export const metadata = { title: "Search" }

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Search the lexicon</h1>
        <p className="text-muted-foreground">
          Try a known term (Rizz), a new one (brainrot), a made-up word (zorbleflux), or a sensitive lookup (kms).
        </p>
      </div>
      <SearchPanel />
    </div>
  )
}
