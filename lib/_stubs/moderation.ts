import "server-only"
import { isMockLlm, simulate } from "./llm"

// STUDENT-FACING MODERATION STUB — the "free moderation endpoint" in the scope.
//
// - Mock (default): flags a small fixed set of synthetic patterns (below) so the
//   gate's combine/fail-closed logic can be built and tested offline.
//   MOCK_MODERATION_LATENCY_MS / MOCK_MODERATION_FAILURE_RATE simulate a slow or
//   failing provider.
// - Real: MOCK_LLM=false plus YOUR OWN OPENAI_API_KEY → the free OpenAI
//   moderation endpoint (omni-moderation-latest).
//
// Production already runs its own model-based moderation layer after the
// deterministic rules; your gate's contract is what lets either provider be
// plugged in behind it.

export type ModerationStatus = "safe" | "flagged" | "unavailable"

export interface ModerationResult {
  status: ModerationStatus
  /** Provider category names, e.g. "self-harm/intent", "violence", "hate". */
  categories: string[]
  provider: string
  latencyMs: number
}

const MOCK_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(make|build) (a )?(bomb|pipe bomb)\b/i, category: "illicit/violent" },
  { pattern: /\b(buy|get) (a )?(gun|knife) (at|for) school\b/i, category: "violence" },
  { pattern: /\b(starv(e|ing) myself|purge after eating)\b/i, category: "self-harm/intent" },
  { pattern: /\b\d{4}\s?\d{3}\s?\d{3}\b/, category: "personal-information" }, // AU mobile-like number
  { pattern: /\[mock-hate\]/i, category: "hate" }, // stand-in marker; never put real slurs in fixtures
]

export async function moderate(text: string): Promise<ModerationResult> {
  const started = Date.now()
  if (isMockLlm()) {
    try {
      await simulate("MOCK_MODERATION_LATENCY_MS", "MOCK_MODERATION_FAILURE_RATE", 150, "moderation provider")
    } catch {
      return { status: "unavailable", categories: [], provider: "mock", latencyMs: Date.now() - started }
    }
    const categories = MOCK_RULES.filter((r) => r.pattern.test(text)).map((r) => r.category)
    return { status: categories.length ? "flagged" : "safe", categories, provider: "mock", latencyMs: Date.now() - started }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: AbortSignal.timeout(2000),
    })
    if (!response.ok) throw new Error(`moderation HTTP ${response.status}`)
    const body = (await response.json()) as { results?: { flagged: boolean; categories: Record<string, boolean> }[] }
    const result = body.results?.[0]
    if (!result) throw new Error("moderation: empty result")
    const categories = Object.entries(result.categories)
      .filter(([, on]) => on)
      .map(([name]) => name)
    return { status: result.flagged ? "flagged" : "safe", categories, provider: "openai", latencyMs: Date.now() - started }
  } catch {
    return { status: "unavailable", categories: [], provider: "openai", latencyMs: Date.now() - started }
  }
}
