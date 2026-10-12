import "server-only"
import type { GenerateDiscovery } from "@/lib/discovery/discover"
import { generateDiscoveryObject } from "@/lib/_stubs/llm"
import type { SearchOutcome } from "@/lib/types"

// Little stub to simulate search and discovery
export async function runSearch(_raw: string, _generate: GenerateDiscovery = generateDiscoveryObject): Promise<SearchOutcome> {
  return { kind: "error", message: "not implemented" }
}
