import "server-only"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { safetyEventSchema } from "@/lib/safety/events"
import type { SafetySurface, SafetyVerdict } from "@/lib/safety/gate"

const referenceSchema = z.string().regex(/^INC-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
const inputSchema = z.object({
  query: z.string().refine(text => text.trim().length > 0),
  surface: z.enum(["search", "suggestion"]),
  verdict: z.object({
    action: z.literal("safeguarding"),
    crisis: z.enum(["self_harm", "harm_to_others"]).nullable(),
    categories: safetyEventSchema.shape.categories,
    decidedBy: z.enum(["rules", "moderation", "fail_closed"]),
    reason: z.string(),
  }).strict(),
  triageLevel: z.enum(["high", "medium", "moderation_only"]),
}).strict()

type TriageLevel = z.infer<typeof inputSchema>["triageLevel"]
export interface IncidentInput {
  query: string
  surface: SafetySurface
  verdict: SafetyVerdict
  triageLevel: TriageLevel
}

export interface SafetyIncident {
  referenceId: string
  query: string
  surface: SafetySurface
  crisis: SafetyVerdict["crisis"]
  categories: SafetyVerdict["categories"]
  recordedAtUtc: string
  recordedAtSydney: string
  localTimezone: "Australia/Sydney"
  triageLevel: TriageLevel
  status: "open" | "closed"
  alertStatus: "pending" | "not_required"
}

const sydneyClock = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset",
})

function sydneyTimestamp(now: Date): string {
  const parts = Object.fromEntries(sydneyClock.formatToParts(now).map(part => [part.type, part.value]))
  const milliseconds = String(now.getUTCMilliseconds()).padStart(3, "0")
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${milliseconds}${parts.timeZoneName.slice(3)}`
}

export const safetyIncidentSchema = z.object({
  referenceId: referenceSchema,
  query: inputSchema.shape.query,
  surface: inputSchema.shape.surface,
  crisis: inputSchema.shape.verdict.shape.crisis,
  categories: safetyEventSchema.shape.categories,
  recordedAtUtc: z.string().datetime(),
  recordedAtSydney: z.string().datetime({ offset: true }),
  localTimezone: z.literal("Australia/Sydney"),
  triageLevel: inputSchema.shape.triageLevel,
  status: z.enum(["open", "closed"]),
  alertStatus: z.enum(["pending", "not_required"]),
}).strict().refine(record => record.triageLevel === "moderation_only"
  ? record.crisis === null && record.status === "closed" && record.alertStatus === "not_required"
  : record.status === "open" && record.alertStatus === "pending", "Invalid incident workflow state.")
  .refine(record => {
    const utc = new Date(record.recordedAtUtc)
    return Number.isFinite(utc.getTime()) && record.recordedAtSydney === sydneyTimestamp(utc)
  }, "Invalid incident timestamps.")

export function createSafetyIncident(input: IncidentInput, now = new Date(), referenceId = `INC-${randomUUID()}`): SafetyIncident {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success || !referenceSchema.safeParse(referenceId).success || !Number.isFinite(now.getTime())) {
    throw new Error("Could not create a safety incident.")
  }
  const { query, surface, verdict, triageLevel } = parsed.data
  const closed = triageLevel === "moderation_only"
  if (closed && (verdict.crisis !== null || verdict.decidedBy !== "moderation")) {
    throw new Error("An explicit crisis cannot be closed as moderation-only.")
  }
  // Triage is supplied by the caller until the client's institutional rules are agreed.
  return {
    referenceId, query, surface, crisis: verdict.crisis, categories: [...new Set(verdict.categories)],
    recordedAtUtc: now.toISOString(),
    recordedAtSydney: sydneyTimestamp(now),
    localTimezone: "Australia/Sydney", triageLevel,
    status: closed ? "closed" : "open", alertStatus: closed ? "not_required" : "pending",
  }
}
