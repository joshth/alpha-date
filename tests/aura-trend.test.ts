import { test } from "node:test"
import assert from "node:assert/strict"
import { auraTrend, type TermEvent } from "@/lib/aura"

const NOW = new Date("2026-11-01T00:00:00.000Z")
const DAY = 86_400_000

function eventsOn(daysAgo: number[], eventType = "search_hit"): TermEvent[] {
  return daysAgo.map((d) => ({ eventType, createdAt: new Date(NOW.getTime() - d * DAY - DAY / 2) }))
}

test("auraTrend returns 26 weekly values in [0, 1] with max exactly 1 for a rising shape", () => {
  // week w (0 = oldest) gets w + 1 events
  const rising = Array.from({ length: 26 }, (_, w) => Array(w + 1).fill((25 - w) * 7 + 3)).flat()
  const trend = auraTrend(eventsOn(rising), NOW)
  assert.equal(trend.length, 26)
  assert.ok(trend.every((v) => v >= 0 && v <= 1))
  assert.equal(Math.max(...trend), 1)
  assert.equal(trend[25], 1)
  assert.equal(trend[0], 1 / 26)
})

test("auraTrend divides each week's total by the largest week", () => {
  const trend = auraTrend(eventsOn([180, 0, 0]), NOW)
  assert.deepEqual(trend, [0.5, ...Array(24).fill(0), 1])
})

test("auraTrend ignores model/prompt events and events 182 or more days ago", () => {
  const events = [
    ...eventsOn([3]),
    ...eventsOn([182, 300]),
    ...eventsOn([0, 0, 0], "llm_generated"),
    ...eventsOn([100, 100], "prompt_generated"),
  ]
  assert.deepEqual(auraTrend(events, NOW), [...Array(25).fill(0), 1])
})

test("auraTrend returns 26 zeros with no counted events", () => {
  assert.deepEqual(auraTrend([], NOW), Array(26).fill(0))
  assert.deepEqual(auraTrend(eventsOn([1, 2], "llm_generated"), NOW), Array(26).fill(0))
})
