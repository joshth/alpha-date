import { Skeleton } from "@/components/ui/skeleton"

export function PageLoading() {
  return <div role="status" aria-live="polite" aria-label="Loading page" className="space-y-4" data-page-loading>
    <span className="sr-only">Loading page</span>
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-80 max-w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
}
