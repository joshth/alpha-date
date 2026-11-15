import "server-only"
import { and, count, gte, lt } from "drizzle-orm"
import { z } from "zod"
import { getDb, type Db } from "@/lib/_stubs/db"
import { safetyEvents } from "@/lib/_stubs/schema"
import { safetyEventSchema, type SafetyEvent } from "@/lib/safety/events"

const periodSchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
}).strict().refine(period => Date.parse(period.from) < Date.parse(period.to))

export interface SafetyActivity {
  period: { from: string; to: string }
  evaluated: number
  allowed: number
  blocked: number
  blockedRate: number | null
  byOutcome: Record<SafetyEvent["outcome"], number>
}

export function createSafetyActivityReader(database: () => Promise<Db> = getDb) {
  return async (period: { from: string; to: string }): Promise<SafetyActivity> => {
    const parsed = periodSchema.safeParse(period)
    if (!parsed.success) throw new Error("Choose a valid time period with the start before the end.")
    const from = new Date(parsed.data.from)
    const to = new Date(parsed.data.to)

    try {
      const db = await database()
      const rows = await db.select({ outcome: safetyEvents.outcome, total: count() })
        .from(safetyEvents)
        .where(and(gte(safetyEvents.recordedAt, from), lt(safetyEvents.recordedAt, to)))
        .groupBy(safetyEvents.outcome)
      const byOutcome: SafetyActivity["byOutcome"] = { safe: 0, refuse: 0, safeguarding: 0, gentle_support: 0 }
      for (const row of rows) {
        const outcome = safetyEventSchema.shape.outcome.parse(row.outcome)
        byOutcome[outcome] = z.number().int().nonnegative().safe().parse(row.total)
      }
      const evaluated = z.number().int().safe().parse(Object.values(byOutcome).reduce((sum, total) => sum + total, 0))
      const allowed = byOutcome.safe
      const blocked = evaluated - allowed
      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        evaluated, allowed, blocked, blockedRate: evaluated === 0 ? null : blocked / evaluated, byOutcome,
      }
    } catch {
      throw new Error("Could not load safety activity. Please try again.")
    }
  }
}

export const readSafetyActivity = createSafetyActivityReader()
