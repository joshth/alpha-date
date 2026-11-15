import { SafetyActivitySummary } from "@/components/safety/activity-summary"
import { loadSafetyActivityView, type ActivityParams } from "@/lib/safety/activity-view"

export const metadata = { title: "Safety activity" }
export const dynamic = "force-dynamic"

export default async function SafetyActivityPage({ searchParams }: { searchParams: Promise<ActivityParams> }) {
  const view = await loadSafetyActivityView(await searchParams)
  return <SafetyActivitySummary view={view} />
}
