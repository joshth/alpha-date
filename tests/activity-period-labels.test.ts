import assert from "node:assert/strict"
import test from "node:test"
import { activityPeriodLabel, activityWeeks, activityWeekYear } from "@/lib/safety/activity-period-labels"

test("period labels describe the actual UTC range", () => {
  assert.equal(activityPeriodLabel("week", "2026-11-02"), "2/11 - 8/11 (2026)")
  assert.equal(activityPeriodLabel("week", "2026-11-15"), "9/11 - 15/11 (2026)")
  assert.equal(activityPeriodLabel("month", "2026-11-15"), "November 2026")
  assert.equal(activityPeriodLabel("year", "2026-11-15"), "2026")
  assert.equal(activityPeriodLabel("day", "2026-11-15"), "15 November 2026")
})

test("week options include all ISO weeks, including year crossings", () => {
  const weeks = activityWeeks(2026)
  assert.equal(weeks.length, 53)
  assert.equal(weeks[0].date, "2025-12-29")
  assert.equal(weeks[52].date, "2026-12-28")
  assert.equal(activityWeekYear("2027-01-01"), 2026)
  assert.equal(activityWeeks(2027).length, 52)
  assert.match(weeks[0].label, /2025 \/ 2026/)
  assert.deepEqual(activityWeeks(NaN), [])
  assert.deepEqual(activityWeeks(10000), [])
})
