"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { reviewTerm } from "@/app/lab/actions"
import { Check, X } from "lucide-react"

export function ReviewButtons({ termId }: { termId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const decide = async (decision: "published" | "rejected") => {
    setBusy(true)
    try {
      const result = await reviewTerm(termId, decision)
      if (result.success) {
        toast({ title: decision === "published" ? "Published" : "Rejected", description: result.message })
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Review failed", description: result.message })
        setBusy(false)
      }
    } catch {
      // Covers transport failures and the middleware's 429 rate-limit response.
      toast({
        variant: "destructive",
        title: "Review failed",
        description: "The request was rejected (possibly rate-limited). Wait a moment and try again.",
      })
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy} onClick={() => decide("published")}>
        <Check className="mr-2 h-4 w-4" aria-hidden="true" /> Publish
      </Button>
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide("rejected")}>
        <X className="mr-2 h-4 w-4" aria-hidden="true" /> Reject
      </Button>
    </div>
  )
}
