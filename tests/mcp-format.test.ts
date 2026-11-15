import { test } from "node:test"
import assert from "node:assert/strict"
import { answer, MAX_SUMMARY, plainText } from "@/lib/mcp/format"

test("plainText strips HTML tags", () => {
  assert.equal(plainText("<p>Hi <b>there</b></p>"), "Hi there")
})

test("plainText strips emoji, including ZWJ sequences", () => {
  assert.equal(plainText("bussin 🔥💯"), "bussin")
  assert.equal(plainText("family 👨‍👩‍👧 time"), "family time")
})

test("plainText strips Markdown marks and turns table pipes into commas", () => {
  assert.equal(plainText("**bold** and `code`"), "bold and code")
  assert.equal(plainText("# Title"), "Title")
  assert.equal(plainText("> quoted"), "quoted")
  assert.equal(plainText("rizz | charm"), "rizz, charm")
})

test("plainText keeps newlines", () => {
  assert.equal(plainText("a\nb"), "a\nb")
})

test("answer keeps a short summary and puts details on the following lines", () => {
  assert.equal(answer("Rizz means charm.", ["Used since 2022.", "Slang."]), "Rizz means charm.\nUsed since 2022.\nSlang.")
})

test("answer cuts a long summary to MAX_SUMMARY characters ending in ...", () => {
  const first = answer("x".repeat(120), ["detail"]).split("\n")[0]
  assert.equal(MAX_SUMMARY, 80)
  assert.ok(first.length <= MAX_SUMMARY, `length ${first.length}`)
  assert.ok(first.endsWith("..."))
})

test("answer skips empty details", () => {
  assert.equal(answer("Summary", ["one", "", "  ", "two"]), "Summary\none\ntwo")
})
