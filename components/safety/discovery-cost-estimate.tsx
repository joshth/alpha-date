import { estimateGpt4oMiniSavings } from "@/lib/safety/discovery-cost"
import type { DiscoveryUsage } from "@/lib/safety/discovery-usage"

const usd = new Intl.NumberFormat("en-AU", {style: "currency", currency: "USD", maximumFractionDigits: 6})
const monthlyUsd = new Intl.NumberFormat("en-AU", {style: "currency", currency: "USD"})

export function DiscoveryCostEstimate({callsAvoided, configured, model}: {
  callsAvoided: number
  configured: DiscoveryUsage["estimate"]
  model: string
}) {
  const supported = model === "gpt-4o-mini" || model === "gpt-4o-mini-2024-07-18"
  const estimate = configured ?? (supported ? estimateGpt4oMiniSavings(callsAvoided, 500, 500) : null)
  const monthly = configured ? 500 * configured.averageCostUsd : supported ? estimateGpt4oMiniSavings(500, 500, 500)?.savingsUsd : null
  return (
    <div>
      <dt>Estimated savings (USD)</dt>
      <dd>
        <span className="font-semibold">{estimate ? usd.format(estimate.savingsUsd) : "Average cost unavailable"}</span>
        {monthly != null && <p className="mt-2 text-sm text-muted-foreground">At 500 searches/month: up to {monthlyUsd.format(monthly)} saved if every search avoids AI.</p>}
      </dd>
    </div>
  )
}
