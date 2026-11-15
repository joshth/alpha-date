import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { createAuraFit } from "@/lib/aura/fit"
import type { FitCommand } from "@/lib/aura/fit-command"
import { auraTrend, TREND_WEEKS, type TermEvent } from "@/lib/aura/index"

const NOW = new Date("2026-11-13T00:00:00Z")
const fitLine = (stage: string | null = "emerging") => JSON.stringify({
  term: "bussin", generation: "gen_z", modelVersion: "v", now: "2026-11-13", weeks: ["2026-11-06", "2026-11-13"],
  counts: [1, 2], fitted: { I: [0.1, 0.2], S: [0.9, 0.8], R: [0, 0], Gamma: [0.1, 0.1] },
  r: 0.5, delta: 0.1, stage, confidence: 0.8, peakWeek: "2026-11-13", windowStart: "2026-11-06",
})
const noData = JSON.stringify({ error: "no_data", term: "x" })
const events = (n: number): TermEvent[] =>
  Array.from({ length: n }, (_, i) => ({ eventType: "search", createdAt: new Date(NOW.getTime() - (i % 100) * 86_400_000) }))

function setup(outputs: string[], evs: TermEvent[] = [], names: string[] = []) {
  const calls: FitCommand[] = []
  const fitAuraTerm = createAuraFit({
    runFit: async (cmd) => ({ code: 0, stdout: outputs[Math.min(calls.push(cmd) - 1, outputs.length - 1)] }),
    getTermEvents: async () => evs,
    listPublishedTermNames: async () => names,
    now: () => NOW,
  })
  return { calls, fitAuraTerm }
}

test("a vendored term fits without counts", async () => {
  const { calls, fitAuraTerm } = setup([fitLine()])
  const res = await fitAuraTerm("bussin")
  assert.equal(res.kind, "fit")
  assert.equal(res.kind === "fit" && res.source, "vendored")
  assert.equal(res.kind === "fit" && res.stageNote, null)
  assert.ok(!calls[0].args.includes("--counts"))
})

test("results are cached by model version and normalised term", async () => {
  const { calls, fitAuraTerm } = setup([fitLine()])
  await fitAuraTerm("Bussin")
  await fitAuraTerm("  bussin ")
  assert.equal(calls.length, 1)
})

test("an unknown term falls back to a synthetic fit from its events", async () => {
  const evs = events(60)
  const { calls, fitAuraTerm } = setup([noData, fitLine()], evs)
  const res = await fitAuraTerm("newword")
  assert.equal(res.kind === "fit" && res.source, "synthetic")
  assert.equal(calls.length, 2)
  assert.ok(calls[1].args.includes("--counts"))
  const input = JSON.parse(calls[1].input!)
  assert.equal(input.weeks.length, TREND_WEEKS)
  assert.equal(input.weeks.at(-1), NOW.toISOString().slice(0, 10))
  assert.equal((Date.parse(input.weeks[1]) - Date.parse(input.weeks[0])) / 86_400_000, 7)
  assert.deepEqual(input.counts, auraTrend(evs, NOW))
})

test("no data anywhere gives no_data with up to 3 suggestions, best first", async () => {
  const { calls, fitAuraTerm } = setup([noData], [], ["rizz", "rizzler", "mid", "bussin"])
  const res = await fitAuraTerm("rizzz")
  assert.equal(res.kind, "no_data")
  if (res.kind !== "no_data") return
  assert.equal(res.term, "rizzz")
  assert.equal(res.suggestions[0], "rizz")
  assert.ok(res.suggestions.length <= 3)
  assert.equal(calls.length, 1)
})

test("a null stage carries a note", async () => {
  const { fitAuraTerm } = setup([fitLine(null)])
  const res = await fitAuraTerm("bussin")
  assert.equal(res.kind === "fit" && res.stageNote, "No stage yet: the curve hasn't taken off")
})

test("the module never calls fetch", async () => {
  const real = globalThis.fetch
  globalThis.fetch = (() => { throw new Error("fetch called") }) as typeof fetch
  try {
    await setup([noData, fitLine()], events(60)).fitAuraTerm("newword")
    await setup([fitLine()]).fitAuraTerm("bussin")
  } finally { globalThis.fetch = real }
})
