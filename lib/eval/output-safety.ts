import type { ModerationResult } from "@/lib/_stubs/moderation"
import { toDiscoveredTerm } from "@/lib/discovery/discover"
import { createSafeDiscovery } from "@/lib/discovery/safe-discovery"
import type { OutputSafetyCase } from "@/lib/eval/golden"
import type { checkInputSafety } from "@/lib/safety/gate"
import { createSafeTermLookup } from "@/lib/safety/safe-term-lookup"
import { createSearchTerm } from "@/lib/search"

export async function evaluateOutputSafety(
  fixtures: readonly OutputSafetyCase[],
  gate: typeof checkInputSafety,
  moderate: (text: string) => Promise<ModerationResult>,
) {
  const checks = []
  for (const fixture of fixtures) {
    const profile = { isLegit: true, definition: fixture.definition, examples: fixture.examples }
    const term = toDiscoveredTerm(fixture.input, profile)
    if (!term) throw new Error(`Invalid output safety fixture: ${fixture.id}`)
    for (const path of ["generated", "cached"] as const) {
      let reachedLookup = false
      let generated = 0
      let inserted = 0
      const search = createSearchTerm({
        checkInputSafety: gate,
        getTermByKey: createSafeTermLookup(async () => {
          reachedLookup = true
          return path === "cached" ? {
            id: term.id, term, status: "published", source: "synthetic", createdAt: new Date(0).toISOString(),
          } : null
        }, moderate),
        generateDiscoveryObject: createSafeDiscovery(async () => {
          generated++
          return profile
        }, moderate),
        logTermEvent: async () => {},
        saveDiscoveredTerm: async () => { inserted++; return null },
      })
      const outcome = await search(fixture.input)
      const shown = path === "generated" ? outcome.kind === "discovered" : outcome.kind === "found"
      const withheld = outcome.kind === "error" && outcome.message === "Something went wrong looking that up. Please try again."
      const actual = shown ? "shown" : withheld ? "withheld" : "unexpected"
      const expectedInserts = fixture.expected === "shown" && path === "generated" ? 1 : 0
      checks.push({
        id: fixture.id, path, expected: fixture.expected, actual, inserted,
        passed: reachedLookup && generated === Number(path === "generated") &&
          actual === fixture.expected && inserted === expectedInserts,
      })
    }
  }
  return {
    total: checks.length,
    passed: checks.filter(check => check.passed).length,
    failedChecks: checks.filter(check => !check.passed).map(({ id, path }) => ({ id, path })),
    checks,
  }
}
