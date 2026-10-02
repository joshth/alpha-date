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

export async function generateDiscoveryObject(input: { prompt: string; searchTerm: string }): Promise<DiscoveryOutput> {
  if (isMockLlm()) {
    await simulate("MOCK_LLM_LATENCY_MS", "MOCK_LLM_FAILURE_RATE", 300, "AI provider")
    return mockDiscovery(input.searchTerm)
  }

  const { generateObject } = await import("ai")
  const { openai } = await import("@ai-sdk/openai")
  const { object } = await generateObject({
    model: openai(process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"),
    schema: discoverySchema,
    prompt: input.prompt,
    temperature: 0.3,
  })
  return object
}
