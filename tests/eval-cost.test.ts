import "./setup"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  estimateTokens,
  formatUsd,
  type MeteredCall,
  meterDiscovery,
  pricingFor,
  runTiming,
  summariseCost,
} from "@/lib/eval/cost"

const close = (actual: number | null, expected: number, label: string) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${label}: ${actual} vs ${expected}`)

const mockConfig = { mock: true, model: "mock", baseURL: null }

test("calls without provider usage are estimated at 4 characters per token", async () => {
  assert.equal(estimateTokens(""), 0)
  assert.equal(estimateTokens("abcd"), 1)
  assert.equal(estimateTokens("abcde"), 2)
  const meter = meterDiscovery(async () => ({ isLegit: false }))
  await meter.generate({ prompt: "x".repeat(400), searchTerm: "vemble" })
  // JSON answer {"isLegit":false} is 17 characters -> 5 tokens.
  assert.deepEqual(meter.calls, [{ searchTerm: "vemble", promptTokens: 100, completionTokens: 5, source: "estimate" }])
})

test("provider-reported usage is used as is, and failed calls are not costed", async () => {
  const meter = meterDiscovery(async ({ searchTerm }, onUsage) => {
    if (searchTerm === "down") throw new Error("Simulated AI provider failure")
    onUsage?.({ promptTokens: 210, completionTokens: 40 })
    return { isLegit: true, definition: "d" }
  })
  await meter.generate({ prompt: "p", searchTerm: "rizz" })
  await assert.rejects(meter.generate({ prompt: "p", searchTerm: "down" }))
  assert.deepEqual(meter.calls, [{ searchTerm: "rizz", promptTokens: 210, completionTokens: 40, source: "provider" }])
})

test("a provider that reports no numbers falls back to the estimate", async () => {
  const meter = meterDiscovery(async (_input, onUsage) => {
    onUsage?.({ promptTokens: Number.NaN, completionTokens: Number.NaN })
    return { isLegit: false }
  })
  await meter.generate({ prompt: "abcd", searchTerm: "x" })
  assert.equal(meter.calls[0].source, "estimate")
})

test("pricing: settings first, then mock, local, known hosted model, otherwise unknown", () => {
  const override = pricingFor(mockConfig, { LLM_PRICE_INPUT_PER_MTOK: "1", LLM_PRICE_OUTPUT_PER_MTOK: "2" })
  assert.deepEqual(override, { inputPerMTokUsd: 1, outputPerMTokUsd: 2, source: "LLM_PRICE_* settings" })
  assert.match(pricingFor(mockConfig, {})!.source, /projection only/)
  assert.equal(pricingFor(mockConfig, {})!.inputPerMTokUsd, 0.15)

  const local = pricingFor({ mock: false, model: "llama3.2:3b", baseURL: "http://localhost:11434/v1" }, {})
  assert.deepEqual([local?.inputPerMTokUsd, local?.outputPerMTokUsd], [0, 0])
  assert.equal(pricingFor({ mock: false, model: "gpt-4o-mini", baseURL: null }, {})?.outputPerMTokUsd, 0.6)
  assert.equal(pricingFor({ mock: false, model: "gpt-4o-mini", baseURL: "https://other-host.example/v1" }, {}), null)
  assert.equal(pricingFor({ mock: false, model: "some-new-model", baseURL: null }, {}), null)
  assert.throws(() => pricingFor(mockConfig, { LLM_PRICE_INPUT_PER_MTOK: "cheap", LLM_PRICE_OUTPUT_PER_MTOK: "1" }), /must be numbers/)
})

test("cost summary matches a hand-computed example", () => {
  // 2 calls, 1,000,000 tokens in and 500,000 out at $0.15 / $0.60 per million:
  // 0.15 + 0.30 = $0.45 for the run, $225 per 1,000 calls.
  const calls: MeteredCall[] = [
    { searchTerm: "a", promptTokens: 600_000, completionTokens: 200_000, source: "provider" },
    { searchTerm: "b", promptTokens: 400_000, completionTokens: 300_000, source: "estimate" },
  ]
  const summary = summariseCost(calls, pricingFor({ mock: false, model: "gpt-4o-mini", baseURL: null }, {}))
  assert.equal(summary.totalTokens, 1_500_000)
  assert.equal(summary.tokenSource, "mixed")
  close(summary.costUsd, 0.45, "run cost")
  close(summary.costPer1000CallsUsd, 225, "per 1,000 calls")
  assert.equal(summariseCost(calls, null).costUsd, null)
  assert.equal(summariseCost([], null).tokenSource, "none")
  assert.equal(formatUsd(null), "unknown")
  assert.equal(formatUsd(0.45), "$0.4500")
  assert.equal(formatUsd(0.000123), "$0.000123")
})

test("run timing gives wall-clock time and throughput", () => {
  assert.deepEqual(runTiming(1000, 31_000, 20), { wallClockMs: 30_000, callsPerMinute: 40 })
  assert.equal(runTiming(5, 5, 3).callsPerMinute, null)
})
