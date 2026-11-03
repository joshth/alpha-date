import { z } from "zod"
import type { checkInputSafety } from "@/lib/safety/gate"

export const safetyEventSchema = z.object({
  outcome: z.enum(["safe", "refuse", "safeguarding", "gentle_support"]),
  categories: z.array(z.enum([
    "suicide_self_harm",
    "eating_disorder",
    "sexual_exploitation",
    "violence_threat",
    "bullying_harassment",
  ])).max(5),
  recordedAt: z.string().datetime(),
}).strict()

export type SafetyEvent = z.infer<typeof safetyEventSchema>

export function createTrackedSafetyGate(
  gate: typeof checkInputSafety,
  record: (event: SafetyEvent) => Promise<void>,
  now: () => Date = () => new Date(),
): typeof checkInputSafety {
  return async (text, surface = "search") => {
    const verdict = await gate(text, surface)
    try {
      await record(safetyEventSchema.parse({
        outcome: verdict.action,
        categories: [...new Set(verdict.categories)],
        recordedAt: now().toISOString(),
      }))
    } catch {
      // Analytics must never change a safety decision or log sensitive payloads.
    }
    return verdict
  }
}
