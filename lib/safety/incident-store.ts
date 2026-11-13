import "server-only"
import { redactPersonalInformation } from "@/lib/safety/privacy"
import { and, desc, eq } from "drizzle-orm"
import { getDb, type Db } from "@/lib/_stubs/db"
import { safetyIncidents } from "@/lib/_stubs/schema"
import { safetyIncidentSchema, type SafetyIncident } from "@/lib/safety/incidents"

async function withIncidentDeadline<T>(operation: () => Promise<T>, timeoutMs = 1000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Incident storage timed out.")), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export function createSafetyIncidentStore(database: () => Promise<Db> = getDb, timeoutMs = 1000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid incident store timeout.")
  return async (incident: SafetyIncident): Promise<void> => {
    try {
      const record = safetyIncidentSchema.parse(incident)
      await withIncidentDeadline(async () => {
        const db = await database()
        await db.insert(safetyIncidents).values({
          referenceId: record.referenceId, query: redactPersonalInformation(record.query), surface: record.surface,
          crisis: record.crisis, categories: record.categories,
          recordedAtUtc: new Date(record.recordedAtUtc), recordedAtSydney: record.recordedAtSydney,
          localTimezone: record.localTimezone, triageLevel: record.triageLevel,
          status: record.status, alertStatus: record.alertStatus,
        })
      }, timeoutMs)
    } catch {
      throw new Error("Could not save the safety incident.")
    }
  }
}

export const storeSafetyIncident = createSafetyIncidentStore()

export async function recordDemoAlertResult(
  referenceId: string,
  alertStatus: Extract<SafetyIncident["alertStatus"], "simulated" | "failed">,
): Promise<void> {
  await withIncidentDeadline(async () => {
    const db = await getDb()
    await db.update(safetyIncidents).set({ alertStatus })
      .where(and(eq(safetyIncidents.referenceId, referenceId), eq(safetyIncidents.alertStatus, "pending")))
  })
}

export async function readRecentSafetyIncidents() {
  const { referenceId, recordedAtUtc, recordedAtSydney, surface, crisis, triageLevel, status, alertStatus } = safetyIncidents
  const db = await getDb()
  return db.select({ referenceId, recordedAtUtc, recordedAtSydney, surface, crisis, triageLevel, status, alertStatus })
    .from(safetyIncidents)
    .orderBy(desc(recordedAtUtc), desc(referenceId))
    .limit(50)
}

export async function readRecentSafetyIncidentDetails() {
  const { referenceId, query, recordedAtUtc, recordedAtSydney, surface, crisis, triageLevel, status, alertStatus } = safetyIncidents
  const db = await getDb()
  const rows = await db.select({ referenceId, query, recordedAtUtc, recordedAtSydney, surface, crisis, triageLevel, status, alertStatus })
    .from(safetyIncidents)
    .orderBy(desc(recordedAtUtc), desc(referenceId))
    .limit(50)
  return rows.map(row => ({ ...row, query: redactPersonalInformation(row.query) }))
}
