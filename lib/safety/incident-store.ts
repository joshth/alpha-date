import "server-only"
import { getDb, type Db } from "@/lib/_stubs/db"
import { safetyIncidents } from "@/lib/_stubs/schema"
import { safetyIncidentSchema, type SafetyIncident } from "@/lib/safety/incidents"

export function createSafetyIncidentStore(database: () => Promise<Db> = getDb, timeoutMs = 1000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid incident store timeout.")
  return async (incident: SafetyIncident): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const record = safetyIncidentSchema.parse(incident)
      const write = async () => {
        const db = await database()
        await db.insert(safetyIncidents).values({
          referenceId: record.referenceId, query: record.query, surface: record.surface,
          crisis: record.crisis, categories: record.categories,
          recordedAtUtc: new Date(record.recordedAtUtc), recordedAtSydney: record.recordedAtSydney,
          localTimezone: record.localTimezone, triageLevel: record.triageLevel,
          status: record.status, alertStatus: record.alertStatus,
        })
      }
      await Promise.race([
        write(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Incident storage timed out.")), timeoutMs)
        }),
      ])
    } catch {
      throw new Error("Could not save the safety incident.")
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }
}

export const storeSafetyIncident = createSafetyIncidentStore()
