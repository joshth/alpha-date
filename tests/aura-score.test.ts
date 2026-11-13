import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"
import { LOW_CONFIDENCE, scoreTermLifecycle, type TermEvent } from "@/lib/aura"

const NOW = new Date("2026-11-01T00:00:00.000Z")
const DAY = 86_400_000

function eventsOn(daysAgo: number[], eventType = "search_hit"): TermEvent[] {
  return daysAgo.map((d) => ({ eventType, createdAt: new Date(NOW.getTime() - d * DAY - DAY / 2) }))
}

test("scoreTermLifecycle returns null when there are no events", () => {
  assert.equal(scoreTermLifecycle([], NOW), null)
})

test("scoreTermLifecycle returns null below MIN_EVENTS counted events, ignoring llm_generated and prompt_generated", () => {
  const counted = eventsOn(Array.from({ length: 20 }, (_, i) => i * 5))
  const ignored = [
    ...eventsOn(Array.from({ length: 40 }, (_, i) => i * 4), "llm_generated"),
    ...eventsOn(Array.from({ length: 40 }, (_, i) => i * 4), "prompt_generated"),
  ]
  assert.equal(scoreTermLifecycle([...counted, ...ignored], NOW), null)
})

// One day's events: round(rate(i)) at noon of the day (179 - i) days before NOW, i = 0..179
function eventsFromRate(rate: (i: number) => number): TermEvent[] {
  return Array.from({ length: 180 }, (_, i) => eventsOn(Array(Math.round(rate(i))).fill(179 - i))).flat()
}

test("scoreTermLifecycle: linear rise is emerging", () => {
  assert.equal(scoreTermLifecycle(eventsFromRate((i) => 0.5 + (7.5 * i) / 179), NOW)?.stage, "emerging")
})

test("scoreTermLifecycle: steady at its own peak is peaking", () => {
  assert.equal(scoreTermLifecycle(eventsFromRate(() => 6), NOW)?.stage, "peaking")
})

test("scoreTermLifecycle: linear fall is declining", () => {
  assert.equal(scoreTermLifecycle(eventsFromRate((i) => 8 - (7.5 * i) / 179), NOW)?.stage, "declining")
})

test("scoreTermLifecycle: early blip then flat low rate is parent_territory", () => {
  assert.equal(scoreTermLifecycle(eventsFromRate((i) => (i < 3 ? 8 : 2)), NOW)?.stage, "parent_territory")
})

test("scoreTermLifecycle: held-out fixture accuracy >= 0.55", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/aura-fixtures-test.json", import.meta.url), "utf8"))
  let hits = 0
  for (const c of fixture.cases) {
    const now = new Date(c.now).getTime()
    const at = (daysAgo: number, eventType: string) => ({ eventType, createdAt: new Date(now - daysAgo * DAY - DAY / 2) })
    const events = [
      ...c.days.flatMap((n: number, i: number) => Array.from({ length: n }, () => at(179 - i, "search_hit"))),
      ...Array.from({ length: c.ignored }, (_, k) => at((k * 7) % 180, "llm_generated")),
    ]
    if (scoreTermLifecycle(events, new Date(c.now))?.stage === c.stage) hits++
  }
  const accuracy = hits / fixture.cases.length
  assert.ok(accuracy >= 0.55, `accuracy ${accuracy.toFixed(3)} (${hits}/${fixture.cases.length})`)
})

test("LOW_CONFIDENCE is exported and equals 0.4", () => {
  assert.equal(LOW_CONFIDENCE, 0.4)
})

test("confidence is counted events / 365, capped at 1", () => {
  const sparse = scoreTermLifecycle(eventsOn(Array.from({ length: 73 }, (_, i) => i * 2)), NOW)
  assert.ok(sparse && Math.abs(sparse.confidence - 0.2) < 1e-9, `confidence ${sparse?.confidence}`)
  assert.equal(scoreTermLifecycle(eventsFromRate(() => 6), NOW)?.confidence, 1)
})

test("explanation states peak share and 180-day change in one sentence", () => {
  assert.equal(
    scoreTermLifecycle(eventsFromRate((i) => 8 - (7.5 * i) / 179), NOW)?.explanation,
    "At 24% of its 180-day peak, down 68 points in 180 days.",
  )
  assert.equal(
    scoreTermLifecycle(eventsFromRate(() => 6), NOW)?.explanation,
    "At 100% of its 180-day peak, level over 180 days.",
  )
})
