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

test("normaliseSuggestion does not expand multi-digit number tokens", () => {
  assert.equal(normaliseSuggestion("100 200"), "100200")
})

test("normaliseSuggestion gives six-seven variants the sixseven key", () => {
  assert.equal(normaliseSuggestion("6 7"), "sixseven")
  assert.equal(normaliseSuggestion("6-7"), "sixseven")
  assert.equal(normaliseSuggestion("6 - 7"), "sixseven")
  assert.equal(normaliseSuggestion("6--7"), "sixseven")
  assert.equal(normaliseSuggestion("6 7 "), "sixseven")
  assert.equal(normaliseSuggestion("six seven"), "sixseven")
})

test("normaliseSuggestion expands other separated single-digit sequences", () => {
  assert.equal(normaliseSuggestion("0 0"), "zerozero")
  assert.equal(normaliseSuggestion("3 8"), "threeight")
  assert.equal(normaliseSuggestion("three eight"), "threeight")
  assert.equal(normaliseSuggestion("threeeight"), "threeight")
})

test("normaliseSuggestion does not expand a lone digit", () => {
  assert.equal(normaliseSuggestion("6"), "6")
})

test("normaliseSuggestion keeps 67 distinct from six seven", () => {
  assert.equal(normaliseSuggestion("67"), "67")
})

test("normaliseSuggestion does not rewrite leetspeak", () => {
  assert.equal(normaliseSuggestion("l33t"), "l33t")
})
