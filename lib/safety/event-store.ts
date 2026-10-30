import "server-only"
import { getDb, type Db } from "@/lib/_stubs/db"
import { safetyEvents } from "@/lib/_stubs/schema"
import { safetyEventSchema, type SafetyEvent } from "@/lib/safety/events"

export function createSafetyEventRecorder(database: () => Promise<Db> = getDb, timeoutMs = 1000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid safety event timeout.")

  return async (event: SafetyEvent): Promise<void> => {
    const parsed = safetyEventSchema.parse(event)
    let timer: ReturnType<typeof setTimeout> | undefined
    const write = async () => {
      const db = await database()
      await db.insert(safetyEvents).values({
        outcome: parsed.outcome,
        categories: parsed.categories,
        recordedAt: new Date(parsed.recordedAt),
      })
    }
    try {
      await Promise.race([
        write(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Safety event recording timed out.")), timeoutMs)
        }),
      ])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }
}

export const recordSafetyEvent = createSafetyEventRecorder()
