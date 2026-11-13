import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { trendSentence, lifecycleRows, VIEW_WEEKS } from "../lib/aura/trend-text"
import type { SirsFit } from "../lib/aura/fit-command"

test("trendSentence: stage null", () => {
  assert.equal(trendSentence({ r: 0.1, delta: 0, stage: null }), "No stage yet: the curve hasn't taken off.")
})

test("trendSentence: down from peak, at peak, no change", () => {
  assert.equal(trendSentence({ r: 0.65, delta: -0.2, stage: "declining" }), "Down 35% from its peak, down 20 points in the last 180 days.")
  assert.equal(trendSentence({ r: 1, delta: 0.4, stage: "peaking" }), "At its peak, up 40 points in the last 180 days.")
  assert.equal(trendSentence({ r: 1, delta: -0.004, stage: "peaking" }), "At its peak, no change in the last 180 days.")
  assert.equal(trendSentence({ r: 0.9, delta: 0.004, stage: "emerging" }), "Down 10% from its peak, no change in the last 180 days.")
})

test("trendSentence: one point is singular", () => {
  assert.equal(trendSentence({ r: 0.09, delta: -0.01, stage: "parent_territory" }), "Down 91% from its peak, down 1 point in the last 180 days.")
  assert.equal(trendSentence({ r: 1, delta: 0.012, stage: "peaking" }), "At its peak, up 1 point in the last 180 days.")
})

const N = 200
const day = (i: number) => new Date(Date.UTC(2020, 0, 6 + 7 * i)).toISOString().slice(0, 10)
const weeks = Array.from({ length: N }, (_, i) => day(i))
const ser = (f: (i: number) => number) => weeks.map((_, i) => f(i))
const fit: SirsFit = {
  term: "rizz", generation: "g", modelVersion: "m", now: weeks[N - 1], weeks,
  counts: ser((i) => i), fitted: { I: ser((i) => i / 1000), S: ser(() => 0.7), R: ser(() => 0.1), Gamma: ser((i) => i / 500) },
  r: 1, delta: 0.1, stage: "peaking", confidence: 0.9, peakWeek: weeks[N - 1], windowStart: weeks[N - 26],
}

test("lifecycleRows: last VIEW_WEEKS weeks, mapped, window flag", () => {
  assert.equal(VIEW_WEEKS, 156)
  const rows = lifecycleRows(fit)
  assert.equal(rows.length, 156)
  assert.equal(rows[0].week, weeks[N - 156])
  assert.equal(rows[155].week, weeks[N - 1])
  const i = N - 10
  assert.deepEqual(rows[155 - 9], {
    week: weeks[i], interest: i, fitted: i / 1000, susceptible: 0.7,
    infected: 1 - 0.7 - 0.1, recovered: 0.1, feedback: i / 500, inWindow: true,
  })
  const inWin = rows.filter((r) => r.inWindow)
  assert.equal(inWin.length, 26)
  assert.ok(inWin.every((r) => r.week >= weeks[N - 26]))
  assert.equal(rows[0].inWindow, false)
})

test("lifecycleRows: fewer weeks than the view returns all", () => {
  const n = 10
  const short = { ...fit, weeks: weeks.slice(0, n), counts: fit.counts.slice(0, n),
    fitted: { I: fit.fitted.I.slice(0, n), S: fit.fitted.S.slice(0, n), R: fit.fitted.R.slice(0, n), Gamma: fit.fitted.Gamma.slice(0, n) } }
  assert.equal(lifecycleRows(short).length, n)
})
