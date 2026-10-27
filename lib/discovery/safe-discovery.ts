import type { ModerationResult } from "@/lib/_stubs/moderation"
import { createOutputSafetyCheck } from "@/lib/safety/output"
import { discoverySchema } from "./prompt"
import type { GenerateDiscovery } from "./discover"

export function createSafeDiscovery(
  generate: GenerateDiscovery,
  moderate: (text: string) => Promise<ModerationResult>,
): GenerateDiscovery {
  const checkOutput = createOutputSafetyCheck(moderate)
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
    await checkOutput(text)
    return result
  }
}
