import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { foldJapanese } from "@/lib/normalise/japanese"

test("kana readings, katakana and kanji numerals all fold to the same digits", () => {
  assert.equal(foldJapanese("六七"), "67")
  assert.equal(foldJapanese("ろくなな"), "67")
  assert.equal(foldJapanese("ロクナナ"), "67")
})

test("text that is not a number reading is left alone", () => {
  assert.equal(foldJapanese("brainrot"), "brainrot")
  assert.equal(foldJapanese("ろくでなし"), "ろくでなし")
})
