import { assessSafety } from "@/lib/safety/classify"
import type { ModerationResult } from "@/lib/_stubs/moderation"
import { discoverySchema } from "./prompt"
import type { GenerateDiscovery } from "./discover"

export function createSafeDiscovery(
  generate: GenerateDiscovery,
  moderate: (text: string) => Promise<ModerationResult>,
): GenerateDiscovery {
  return async (input) => {
    let raw
    try {
      raw = await generate(input)
    } catch {
      throw new Error("Could not generate a result.")
    }
    const parsed = discoverySchema.safeParse(raw)
    if (!parsed.success) throw new Error("Discovery returned an invalid result.")
    const result = parsed.data
    if (!result.isLegit || !result.definition?.trim()) return result

    const text = [result.definition, ...(result.examples ?? []), result.originAndContext, result.commonSentiment]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join("\n")
    if (assessSafety(text).crisis) throw new Error("Generated result failed its safety check.")

    let moderation
    try {
      moderation = await moderate(text)
    } catch {
      throw new Error("Generated result safety check is unavailable.")
    }
    if (!moderation || moderation.status === "unavailable") {
      throw new Error("Generated result safety check is unavailable.")
    }
    if (moderation.status !== "safe" || !Array.isArray(moderation.categories) || moderation.categories.length > 0) {
      throw new Error("Generated result failed its safety check.")
    }
    return result
  }
}
