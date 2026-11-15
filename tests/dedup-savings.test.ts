import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { dedupSavings } from "@/lib/dedup/savings"

const row = (suggestedTerm: string, count: number, status = "pending") => ({ suggestedTerm, count, status, bytes: 100 })
const fixture = [row("brainrot", 5), row("brain rot", 2), row("brain-rot", 1), row("brainrottt", 1), row("rizz", 3)]

test("known variants collapse to distinct keys with savings and a labelled estimate", () => {
  const s = dedupSavings(fixture)
  assert.equal(s.rawRows, 5)
  assert.equal(s.distinctKeys, 3)
  assert.equal(s.merged, 2)
  assert.equal(s.reductionPct, 40)
  assert.equal(s.reviewItemsSaved, 2)
  assert.equal(s.storageSavedBytes, 200)
  assert.equal(s.submissions, 12)
  assert.deepEqual(s.estimate, { minutesSaved: 4, assumption: "2 min per review" })
})

test("minutesPerReview is configurable and named in the assumption", () => {
  assert.deepEqual(dedupSavings(fixture, 3).estimate, { minutesSaved: 6, assumption: "3 min per review" })
})

test("empty input is all zeros", () => {
  const s = dedupSavings([])
  assert.equal(s.rawRows, 0)
  assert.equal(s.distinctKeys, 0)
  assert.equal(s.merged, 0)
  assert.equal(s.reductionPct, 0)
  assert.equal(s.reviewItemsSaved, 0)
  assert.equal(s.storageSavedBytes, 0)
  assert.equal(s.submissions, 0)
  assert.equal(s.estimate.minutesSaved, 0)
})

test("approved rows merge but do not count as review items saved", () => {
  const s = dedupSavings([row("brainrot", 5, "approved"), row("brain rot", 2, "approved")])
  assert.equal(s.merged, 1)
  assert.equal(s.reviewItemsSaved, 0)
})

test("missing bytes count as zero", () => {
  const s = dedupSavings([{ suggestedTerm: "brainrot", count: 2, status: "pending" }, { suggestedTerm: "brain rot", count: 1, status: "pending" }])
  assert.equal(s.storageSavedBytes, 0)
})
