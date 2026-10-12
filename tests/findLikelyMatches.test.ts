import { findLikelyMatches } from "@/lib/normalise"
import assert from "node:assert/strict"
import { test } from "node:test"

test("findLikelyMatches returns an exact key match", () => {
  assert.deepEqual(findLikelyMatches("brainrot", ["Brain Rot"]), [
    { candidate: "Brain Rot", score: 1, reason: "same_key" },
  ])
})

test("findLikelyMatches returns every candidate with the same key", () => {
  const matches = findLikelyMatches("brainrot", ["Brain Rot", "brain-rot"])

  assert.equal(matches.length, 2)
  assert.deepEqual(new Set(matches.map((match) => match.candidate)), new Set(["Brain Rot", "brain-rot"]))
})

test("findLikelyMatches returns no result when no candidate shares the key", () => {
  assert.deepEqual(findLikelyMatches("brainrot", ["mid"]), [])
})

test("findLikelyMatches excludes non-matching candidates", () => {
  assert.deepEqual(findLikelyMatches("brainrot", ["mid", "Brain Rot"]), [
    { candidate: "Brain Rot", score: 1, reason: "same_key" },
  ])
})

test("findLikelyMatches keeps duplicate candidate records", () => {
  assert.deepEqual(findLikelyMatches("brainrot", ["Brain Rot", "Brain Rot"]), [
    { candidate: "Brain Rot", score: 1, reason: "same_key" },
    { candidate: "Brain Rot", score: 1, reason: "same_key" },
  ])
})

test("findLikelyMatches ignores input without a key", () => {
  assert.deepEqual(findLikelyMatches("!!!", ["Brain Rot", "???"]), [])
  assert.deepEqual(findLikelyMatches("", ["Brain Rot", "???"]), [])
})

test("findLikelyMatches returns no result without candidates", () => {
  assert.deepEqual(findLikelyMatches("brainrot", []), [])
})

test("findLikelyMatches skips candidates without a key", () => {
  assert.deepEqual(findLikelyMatches("brainrot", ["???", "Brain Rot"]), [
    { candidate: "Brain Rot", score: 1, reason: "same_key" },
  ])
})

test("findLikelyMatches uses full suggestion normalisation", () => {
  assert.deepEqual(findLikelyMatches("6 7", ["six seven"]), [
    { candidate: "six seven", score: 1, reason: "same_key" },
  ])
  assert.deepEqual(findLikelyMatches("rizzzz", ["Rizz"]), [
    { candidate: "Rizz", score: 1, reason: "same_key" },
  ])
})
