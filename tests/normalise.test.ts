import { normaliseSuggestion } from "@/lib/normalise";
import assert from "node:assert/strict"
import { test } from "node:test"

test("normaliseSuggestion gives brain rot variants the brainrot key", () => {
  const expected = normaliseSuggestion("brain rot")

  assert.equal(expected, "brainrot")
  assert.equal(normaliseSuggestion("brain-rot"), expected)
  assert.equal(normaliseSuggestion("Brain Rot!"), expected)
})

test("normaliseSuggestion does not merge mid and midd", () => {
  assert.notEqual(normaliseSuggestion("mid"), normaliseSuggestion("midd"))
})

test("normaliseSuggestion reduces letter runs of three or more to two", () => {
  assert.equal(normaliseSuggestion("brainrottt"), "brainrott")
})

test("normaliseSuggestion keeps legitimate double letters", () => {
  assert.equal(normaliseSuggestion("gyatt"), "gyatt")
  assert.equal(normaliseSuggestion("rizz"), "rizz")
})

test("normaliseSuggestion leaves digit runs unchanged", () => {
  assert.equal(normaliseSuggestion("1000"), "1000")
})
