import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LifecycleTab } from "@/components/aura/lifecycle-tab"
import { DedupTab } from "@/components/aura/dedup-tab"
import { fitAuraTerm, getDedupGraph, getDedupSavings, getSemanticEdges } from "../actions"

export const metadata = { title: "Aura" }

export default function AuraPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold">Aura</h1>
        <p className="text-sm text-lab-muted">Where a term sits in its lifecycle, from a SIRS fit to search interest.</p>
      </div>
      <Tabs defaultValue="lifecycle">
        <TabsList className="h-auto w-full justify-start rounded-none border-b border-lab-border bg-transparent p-0">
          <TabsTrigger value="lifecycle" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-lab-text data-[state=active]:bg-transparent data-[state=active]:shadow-none">Lifecycle</TabsTrigger>
          <TabsTrigger value="dedup" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-lab-text data-[state=active]:bg-transparent data-[state=active]:shadow-none">Dedup</TabsTrigger>
        </TabsList>
        <TabsContent value="lifecycle" forceMount className="pt-6 data-[state=inactive]:hidden"><LifecycleTab fitAction={fitAuraTerm} /></TabsContent>
        <TabsContent value="dedup" forceMount className="pt-6 data-[state=inactive]:hidden"><DedupTab savingsAction={getDedupSavings} graphAction={getDedupGraph} semanticAction={getSemanticEdges} /></TabsContent>
      </Tabs>
    </div>
  )
}
