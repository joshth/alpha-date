import "server-only"
import { discoverySchema, type DiscoveryOutput } from "@/lib/discovery/prompt"
import { mockDiscovery } from "./fixtures/mock-discovery"

// STUDENT-FACING AI STUB — not the production model chain.
//
// Production runs a multi-provider fallback chain plus model-based output
// moderation. Here:
// - Mock (default): a deterministic, deliberately imperfect discovery model
//   (see fixtures/mock-discovery.ts). MOCK_LLM_LATENCY_MS and
//   MOCK_LLM_FAILURE_RATE simulate latency and outages.
// - Real: MOCK_LLM=false plus YOUR OWN OPENAI_API_KEY (with a spend cap).

export function isMockLlm(): boolean {
  return process.env.MOCK_LLM !== "false" || !process.env.OPENAI_API_KEY?.trim()
}

export const DEFAULT_DISCOVERY_TEMPERATURE = 0.3

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
}

export function isMockDiscovery(): boolean {
  return process.env.MOCK_LLM !== "false" || (!process.env.OPENAI_API_KEY?.trim() && !process.env.LLM_BASE_URL?.trim())
}

function numberSetting(name: string, check: (n: number) => boolean, rule: string): number | null {
  const raw = process.env[name]?.trim()
  if (!raw) return null
  const value = Number(raw)
  if (!check(value)) throw new Error(`${name} must be ${rule} (got "${raw}")`)
  return value
}

// What the discovery model is for this process; also recorded in every eval report.
export function discoveryModelConfig() {
  const mock = isMockDiscovery()
  const temperature = numberSetting("LLM_TEMPERATURE", (n) => Number.isFinite(n) && n >= 0 && n <= 2, "a number from 0 to 2")
  const seed = numberSetting("LLM_SEED", Number.isInteger, "an integer")
  return {
    mock,
    model: mock ? "mock" : process.env.LLM_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    temperature: mock ? null : (temperature ?? DEFAULT_DISCOVERY_TEMPERATURE),
    seed: mock ? null : seed,
    baseURL: mock ? null : process.env.LLM_BASE_URL?.trim() || null,
  }
}

export class MockProviderFailure extends Error {
  constructor(what: string) {
    super(`Simulated ${what} failure`)
    this.name = "MockProviderFailure"
  }
}

export async function simulate(latencyVar: string, failureVar: string, defaultLatency: number, what: string) {
  const latency = Number(process.env[latencyVar] ?? defaultLatency)
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency))
  const failureRate = Number(process.env[failureVar] ?? 0)
  if (failureRate > 0 && Math.random() < failureRate) throw new MockProviderFailure(what)
}

export async function generateDiscoveryObject(
  input: { prompt: string; searchTerm: string },
  onUsage?: (usage: TokenUsage) => void,
): Promise<DiscoveryOutput> {
  const config = discoveryModelConfig()
  if (config.mock) {
    await simulate("MOCK_LLM_LATENCY_MS", "MOCK_LLM_FAILURE_RATE", 300, "AI provider")
    return mockDiscovery(input.searchTerm)
  }

  const { generateObject, zodSchema } = await import("ai")
  const { createOpenAI } = await import("@ai-sdk/openai")
  const provider = createOpenAI({
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    apiKey: process.env.OPENAI_API_KEY?.trim() || "local",
  })
  // Local servers get the schema twice: as `response_format: json_schema`,
  // which Ollama enforces while generating, and in the system prompt.
  // - Schema only in the prompt: llama3.2 often echoed the schema back instead
  //   of answering (2 of 3 calls failed, 3 Nov 2026).
  // - Schema only enforced: it answered "not slang" for every word, even "rizz".
  const { object, usage } = await generateObject({
    model: config.baseURL ? provider.chat(config.model, { structuredOutputs: true }) : provider.chat(config.model),
    ...(config.baseURL
      ? {
          mode: "json" as const,
          system:
            `JSON schema:\n${JSON.stringify(zodSchema(discoverySchema).jsonSchema)}\n` +
            "You MUST answer with a JSON object that matches the JSON schema above.",
        }
      : {}),
    schema: discoverySchema,
    prompt: input.prompt,
    temperature: config.temperature ?? DEFAULT_DISCOVERY_TEMPERATURE,
    ...(config.seed !== null ? { seed: config.seed } : {}),
  })
  onUsage?.({ promptTokens: usage.promptTokens, completionTokens: usage.completionTokens })
  return object
}
