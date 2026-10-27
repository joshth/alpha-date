import { z } from "zod"
import type { ModerationResult } from "@/lib/_stubs/moderation"
import type { getTermRecord } from "@/lib/terms-store"
import { createOutputSafetyCheck } from "@/lib/safety/output"

const extraText = {
  cautionaryNotes: z.string().nullish(),
  detailedOriginEtymology: z.string().optional(),
  culturalImpactAnalysis: z.string().optional(),
  communicationTips: z.string().optional(),
}
const textProfile = {
  definition: z.string().refine((text) => text.trim().length > 0),
  examples: z.array(z.string()),
  originAndContext: z.string(),
  ...extraText,
}
const contentSchema = z.object({
  ...textProfile,
  term: z.string(),
  pronunciation: z.string().optional(),
  commonSentiment: z.string(),
  sensitivityRating: z.string(),
  tags: z.array(z.string()).optional(),
  educatorDiscussionPoints: z.array(z.object({ ageGroup: z.string(), prompt: z.string() })).optional(),
  translatedContent: z.object({ language: z.string(), ...textProfile }).optional(),
})

function textValues(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(textValues)
  if (value && typeof value === "object") return Object.values(value).flatMap(textValues)
  return []
}

export function createSafeTermLookup(
  lookup: typeof getTermRecord,
  moderate: (text: string) => Promise<ModerationResult>,
): typeof getTermRecord {
  const checkOutput = createOutputSafetyCheck(moderate)
  return async (query) => {
    let record
    try {
      record = await lookup(query)
    } catch {
      throw new Error("Could not retrieve a result.")
    }
    if (!record || record.status === "rejected") return record
    if (record.status !== "published" && record.status !== "pending_review") {
      throw new Error("Stored result is invalid.")
    }
    const parsed = contentSchema.safeParse(record.term)
    if (!parsed.success) throw new Error("Stored result is invalid.")
    await checkOutput(textValues(parsed.data).join("\n"))
    return record
  }
}
