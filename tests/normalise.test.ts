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
