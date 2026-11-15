import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { windowBounds } from "../lib/aura/trend-text"

// Weekly category axis: a shaded band only draws when its ends are real plotted weeks.
const weeks = ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27", "2026-10-04"]

test("windowBounds snaps the 180-day window to plotted weeks", () => {
  assert.deepEqual(windowBounds(weeks, "2026-09-10", "2026-10-04"), { from: "2026-09-13", to: "2026-10-04" })
})

test("windowBounds keeps exact matches and snaps 'now' back to the last week at or before it", () => {
  assert.deepEqual(windowBounds(weeks, "2026-09-13", "2026-09-30"), { from: "2026-09-13", to: "2026-09-27" })
})

test("windowBounds clamps a window that starts before the first plotted week", () => {
  assert.deepEqual(windowBounds(weeks, "2024-01-01", "2026-10-04"), { from: "2026-09-06", to: "2026-10-04" })
})

test("windowBounds is null when nothing is plotted or the window is outside the plotted weeks", () => {
  assert.equal(windowBounds([], "2026-09-10", "2026-10-04"), null)
  assert.equal(windowBounds(weeks, "2027-01-01", "2027-06-01"), null)
})
