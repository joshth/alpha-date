import { test } from "node:test"
import assert from "node:assert/strict"
import { scoreTermLifecycle, type TermEvent } from "@/lib/aura"

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
