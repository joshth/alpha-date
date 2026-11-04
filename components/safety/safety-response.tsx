import type { SafetyVerdict } from "@/lib/safety/gate"
import { CrisisCard } from "@/components/safety/crisis-card"
import { HelpResources } from "@/components/safety/help-resources"

export function SafetyResponse({ verdict, message }: { verdict: SafetyVerdict; message: string }) {
  if (verdict.action === "gentle_support") {
    return (
      <section aria-label="A gentle check-in" className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
        <h2 className="font-semibold text-foreground">A gentle check-in</h2>
        <p role="status" className="text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">You can search for a slang term separately when you're ready.</p>
      </section>
    )
  }
  if (verdict.action === "safeguarding" && verdict.crisis) {
    return <CrisisCard crisis={verdict.crisis} categories={verdict.categories} />
  }
  const categories = verdict.categories.length ? verdict.categories : ["bullying_harassment" as const]
  return (
    <div className="space-y-4">
      <p role="alert" className="text-foreground">{message}</p>
      {(verdict.decidedBy !== "fail_closed" || verdict.categories.length > 0) && (
        <HelpResources categories={categories} />
      )}
    </div>
  )
}
