import { assessSafety } from "@/lib/safety/classify"
import type { ModerationResult } from "@/lib/_stubs/moderation"

export function createOutputSafetyCheck(moderate: (text: string) => Promise<ModerationResult>) {
  return async (text: string): Promise<void> => {
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
  }
}
