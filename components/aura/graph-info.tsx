"use client"
import { Info } from "lucide-react"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { GRAPH_INFO, type GraphInfoId } from "@/lib/aura/graph-info"

export function GraphInfoView({ id }: { id: GraphInfoId }) {
  const g = GRAPH_INFO[id]
  return (
    <div className="space-y-3">
      <h2 className="text-base font-medium">{g.title}</h2>
      <p className="text-sm">{g.shows}</p>
      <h3 className="text-sm font-medium">How to read it</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">{g.read.map((b) => <li key={b}>{b}</li>)}</ul>
      <video controls preload="none" playsInline poster={g.poster} className="w-full rounded border border-lab-border bg-lab-chrome">
        <source src={g.video} type="video/mp4" />
        <track kind="captions" src={g.captions} srcLang="en" label="English" default />
      </video>
      <details className="text-sm">
        <summary className="cursor-pointer">Show transcript</summary>
        <p className="mt-2 text-lab-muted">{g.transcript}</p>
      </details>
    </div>
  )
}

export function GraphInfoButton({ id }: { id: GraphInfoId }) {
  const title = GRAPH_INFO[id].title
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" aria-haspopup="dialog" aria-label={`About this chart: ${title}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-lab-border text-lab-muted hover:bg-lab-raised focus-visible:outline focus-visible:outline-2">
          <Info aria-hidden="true" className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent className="lab overflow-y-auto border-lab-border bg-lab-chrome text-lab-text sm:max-w-md">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">Explanation and short video for this chart</SheetDescription>
        <GraphInfoView id={id} />
        <SheetClose className="mt-4 h-9 rounded border border-lab-border-strong px-3 text-sm">Close</SheetClose>
      </SheetContent>
    </Sheet>
  )
}
