import "./setup"
import assert from "node:assert/strict"
import { test } from "node:test"
import { meterDiscovery, pricingFor, runTiming, summariseCost } from "@/lib/eval/cost"
import { evaluateDiscovery } from "@/lib/eval/discovery"
import type { GoldenCase } from "@/lib/eval/golden"
import { toMarkdown } from "@/lib/eval/report"

const mockConfig = { mock: true, model: "mock", baseURL: null }

test("reports show cost and time, and say when tokens are estimated", async () => {
  const cases: GoldenCase[] = [
    {
      id: "d-1",
      input: "vemble",
      source: "test",
      kind: "discovery",
      category: "invented",
      safety: { action: "safe", categories: [] },
      discovery: { isRealSlang: false },
    },
  ]
  const meter = meterDiscovery(async () => ({ isLegit: false }))
  const discovery = await evaluateDiscovery(cases, meter.generate)
  const config = { ...mockConfig, promptVersion: "prod-2026-09-27", temperature: null, seed: null }
  const markdown = toMarkdown(
    {
      datasetVersion: "9.9.9",
      datasetFile: "eval/golden-set.json",
      datasetSha256: "abcdef0123456789",
      startedAt: "2026-11-01T00:00:00.000Z",
      config,
      timing: runTiming(0, 2000, 1),
      cost: summariseCost(meter.calls, pricingFor(mockConfig, {})),
    },
    discovery,
  )
  assert.match(markdown, /\| Wall-clock time \| 2\.0 s \(30 calls per minute\) \|/)
  assert.match(markdown, /Tokens \(estimated, 4 characters per token\)/)
  assert.match(markdown, /projection only/)
  assert.match(markdown, /Cost per 1,000 calls/)
})
