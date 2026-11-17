import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { foldJapanese, japaneseStem } from "@/lib/normalise/japanese"
import { findLikelyMatches, normaliseSuggestion } from "@/lib/normalise"

test("kana readings, katakana and kanji numerals all fold to the same digits", () => {
  assert.equal(foldJapanese("六七"), "67")
  assert.equal(foldJapanese("ろくなな"), "67")
  assert.equal(foldJapanese("ロクナナ"), "67")
})

test("text that is not a number reading is left alone", () => {
  assert.equal(foldJapanese("brainrot"), "brainrot")
  assert.equal(foldJapanese("ろくでなし"), "ろくでなし")
})

test("suggestions in different Japanese spellings share one key and match same_key", () => {
  assert.equal(normaliseSuggestion("ろくなな"), normaliseSuggestion("六七"))
  const [m] = findLikelyMatches("ろくなな", ["六七"])
  assert.equal(m.reason, "same_key")
})

test("a polite ending is a stem match, not a new term", () => {
  assert.equal(japaneseStem("ろくななです"), "67")
  const [m] = findLikelyMatches("ろくななです", ["六七"])
  assert.equal(m.reason, "stem")
})
