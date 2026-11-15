import "server-only"
import { and, count, eq, gte, lt, sql } from "drizzle-orm"
import { getDb } from "@/lib/_stubs/db"
import { termEvents } from "@/lib/_stubs/schema"
import type { SafetyActivity } from "@/lib/safety/activity"

export interface DiscoveryUsage {
  callsAvoided: number
  estimate: { averageCostUsd: number; savingsUsd: number } | null
}

export async function readDiscoveryUsage(period: SafetyActivity["period"]): Promise<DiscoveryUsage> {
  const db = await getDb()
  // The legacy timestamp column stores database-local time from DEFAULT now().
  const occurredAt = sql`${termEvents.createdAt} AT TIME ZONE current_setting('TimeZone')`
  const [row] = await db.select({ total: count() }).from(termEvents).where(and(
    eq(termEvents.eventType, "ai_call_avoided"),
    gte(occurredAt, sql`${period.from}::timestamptz`),
    lt(occurredAt, sql`${period.to}::timestamptz`),
  ))
  const callsAvoided = row.total
  const configured = process.env.DISCOVERY_AVERAGE_COST_USD?.trim() ?? ""
  const averageCostUsd = /^\d+(?:\.\d+)?$/.test(configured) ? Number(configured) : NaN
  const savingsUsd = callsAvoided * averageCostUsd
  return {
    callsAvoided,
    estimate: Number.isFinite(savingsUsd) ? { averageCostUsd, savingsUsd } : null,
  }
}
