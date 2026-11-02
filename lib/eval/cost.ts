import type { TokenUsage } from "@/lib/_stubs/llm"
import type { GenerateDiscovery } from "@/lib/discovery/discover"
import type { DiscoveryOutput } from "@/lib/discovery/prompt"

// Cost and time per evaluation run (W18EDATE-69).
//
// Every model call is metered. Tokens come from the provider when it reports
// them ("provider"); the mock and some local servers don't, so those calls are
// estimated at 4 characters per token from the prompt and the JSON answer
// ("estimate"). The report always says which, so an estimate is never quoted
// as a measured cost.
//
// Price per million tokens, first match wins:
// 1. LLM_PRICE_INPUT_PER_MTOK and LLM_PRICE_OUTPUT_PER_MTOK (both set);
// 2. a local server (localhost / 127.0.0.1 / ::1) costs 0 per token, but its
//    time is still recorded: on a laptop, time is the real cost;
// 3. the list price of a known hosted model (LIST_PRICES);
// 4. a mock run is priced as production's gpt-4o-mini, as a projection only;
// otherwise the cost is unknown (null) rather than guessed.

export const CHARS_PER_TOKEN = 4

// USD per million tokens [input, output], standard OpenAI API list prices.
// Check https://openai.com/api/pricing before quoting a cost to the client.
export const LIST_PRICES: Record<string, [number, number]> = {
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4o": [2.5, 10],
}

export type { TokenUsage }

export type TokenSource = "provider" | "estimate"

export interface MeteredCall extends TokenUsage {
  searchTerm: string
  source: TokenSource
}

// generateDiscoveryObject's shape: the same call, plus an optional callback the
// real provider uses to report token usage.
export type DiscoveryWithUsage = (
  input: { prompt: string; searchTerm: string },
  onUsage?: (usage: TokenUsage) => void,
) => Promise<DiscoveryOutput>

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}


export function meterDiscovery(generate: DiscoveryWithUsage): { generate: GenerateDiscovery; calls: MeteredCall[] } {
  const calls: MeteredCall[] = []
  const metered: GenerateDiscovery = async (input) => {
    let reported: TokenUsage | null = null
    const output = await generate(input, (usage) => (reported = usage))
    const usage = reported as TokenUsage | null
    if (usage && Number.isFinite(usage.promptTokens) && Number.isFinite(usage.completionTokens)) {
      calls.push({ searchTerm: input.searchTerm, ...usage, source: "provider" })
    } else {
      calls.push({
        searchTerm: input.searchTerm,
        promptTokens: estimateTokens(input.prompt),
        completionTokens: estimateTokens(JSON.stringify(output)),
        source: "estimate",
      })
    }
    return output
  }
  return { generate: metered, calls }
}

export interface Pricing {
  inputPerMTokUsd: number
  outputPerMTokUsd: number
  source: string
}

function isLocal(baseURL: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)
  } catch {
    return false
  }
}

export function pricingFor(
  config: { mock: boolean; model: string; baseURL: string | null },
  env: Record<string, string | undefined> = process.env,
): Pricing | null {
  const input = env.LLM_PRICE_INPUT_PER_MTOK?.trim()
  const output = env.LLM_PRICE_OUTPUT_PER_MTOK?.trim()
  if (input && output) {
    const [inputPerMTokUsd, outputPerMTokUsd] = [Number(input), Number(output)]
    if (!(inputPerMTokUsd >= 0) || !(outputPerMTokUsd >= 0)) {
      throw new Error(`LLM_PRICE_INPUT_PER_MTOK and LLM_PRICE_OUTPUT_PER_MTOK must be numbers ≥ 0 (got "${input}", "${output}")`)
    }
    return { inputPerMTokUsd, outputPerMTokUsd, source: "LLM_PRICE_* settings" }
  }
  if (config.mock) {
    const [i, o] = LIST_PRICES["gpt-4o-mini"]
    return { inputPerMTokUsd: i, outputPerMTokUsd: o, source: "mock run priced as gpt-4o-mini (projection only)" }
  }
  if (config.baseURL && isLocal(config.baseURL)) {
    return { inputPerMTokUsd: 0, outputPerMTokUsd: 0, source: "local server: no per-token charge (time is the cost)" }
  }
  const known = config.baseURL ? undefined : LIST_PRICES[config.model]
  if (known) return { inputPerMTokUsd: known[0], outputPerMTokUsd: known[1], source: `${config.model} list price` }
  return null
}

export interface CostSummary {
  calls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokenSource: TokenSource | "mixed" | "none"
  pricing: Pricing | null
  costUsd: number | null
  costPer1000CallsUsd: number | null
}

export function summariseCost(calls: readonly MeteredCall[], pricing: Pricing | null): CostSummary {
  const promptTokens = calls.reduce((sum, c) => sum + c.promptTokens, 0)
  const completionTokens = calls.reduce((sum, c) => sum + c.completionTokens, 0)
  const sources = new Set(calls.map((c) => c.source))
  const costUsd = pricing
    ? (promptTokens * pricing.inputPerMTokUsd + completionTokens * pricing.outputPerMTokUsd) / 1_000_000
    : null
  return {
    calls: calls.length,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    tokenSource: sources.size === 0 ? "none" : sources.size > 1 ? "mixed" : [...sources][0],
    pricing,
    costUsd,
    costPer1000CallsUsd: costUsd === null || calls.length === 0 ? null : (costUsd / calls.length) * 1000,
  }
}

export function formatUsd(value: number | null): string {
  if (value === null) return "unknown"
  if (value === 0) return "$0"
  return value < 0.01 ? `$${value.toFixed(6)}` : `$${value.toFixed(4)}`
}

export interface RunTiming {
  wallClockMs: number
  callsPerMinute: number | null
}

export function runTiming(startedMs: number, finishedMs: number, calls: number): RunTiming {
  const wallClockMs = finishedMs - startedMs
  return { wallClockMs, callsPerMinute: wallClockMs > 0 ? (calls / wallClockMs) * 60_000 : null }
}

export const PLANNED_SWEEP_CALLS = 4100

export function projectRunTime(timing: RunTiming, measuredCalls: number, calls: number): number | null {
  if (measuredCalls === 0) return null
  return (timing.wallClockMs / measuredCalls) * calls
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "unknown"
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = seconds / 60
  return minutes < 60 ? `${minutes.toFixed(1)} min` : `${(minutes / 60).toFixed(1)} h`
}
