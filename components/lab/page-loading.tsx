import { Skeleton } from "@/components/ui/skeleton"

export type LabLoadingKind = "dashboard" | "aura" | "dedup" | "eval" | "review" | "search" | "activity" | "incidents"

const label: Record<LabLoadingKind, string> = {
  dashboard: "dashboard", aura: "Aura", dedup: "deduplication", eval: "evaluation",
  review: "review queue", search: "search", activity: "safety activity", incidents: "safety incidents",
}

function PageHeading({ titleWidth = "w-48" }: { titleWidth?: string }) {
  return <div className="space-y-2"><Skeleton className={`h-8 ${titleWidth}`} /><Skeleton className="h-4 w-full max-w-2xl" /></div>
}

function TableRows({ count = 5 }: { count?: number }) {
  return <div aria-hidden="true" className="space-y-3">{Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
}

function Content({ kind }: { kind: LabLoadingKind }) {
  switch (kind) {
    case "aura":
      return <>
        <div className="flex max-w-xl gap-3"><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 w-24" /></div>
        <div className="grid grid-cols-2 gap-4 border-y border-lab-border py-4 sm:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        <Skeleton className="h-72 w-full" />
        <TableRows count={6} />
      </>
    case "dedup":
      return <><div className="grid grid-cols-2 gap-4 border-y border-lab-border py-4 sm:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div><Skeleton className="h-96 w-full" /><TableRows count={4} /></>
    case "eval":
      return <><Skeleton className="h-48 w-full" /><Skeleton className="h-10 w-52" /><Skeleton className="h-80 w-full" /></>
    case "review":
      return <><Skeleton className="h-44 w-full" /><Skeleton className="h-36 w-full" /><TableRows count={5} /></>
    case "search":
      return <><div className="flex flex-col gap-3 sm:flex-row"><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 w-28" /></div><Skeleton className="h-48 w-full" /></>
    case "activity":
      return <><div className="flex flex-wrap gap-3"><Skeleton className="h-11 w-56" /><Skeleton className="h-11 w-56" /><Skeleton className="h-11 w-32" /></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div><TableRows count={4} /></>
    case "incidents":
      return <><Skeleton className="h-11 w-full" /><TableRows count={8} /></>
    case "dashboard":
      return <><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div><Skeleton className="h-64 w-full" /></>
  }
}

export function LabPageLoading({ kind }: { kind: LabLoadingKind }) {
  return (
    <section role="status" aria-label={`Loading ${label[kind]}`} className="space-y-6">
      <span className="sr-only">Loading {label[kind]}…</span>
      <PageHeading titleWidth={kind === "activity" || kind === "incidents" ? "w-64" : undefined} />
      <Content kind={kind} />
    </section>
  )
}
