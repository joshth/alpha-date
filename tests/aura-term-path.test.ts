import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { auraTermPath, decodeAuraTerm } from "../lib/aura/term-route"

test("Aura term paths encode a trimmed term as one route segment", () => {
  assert.equal(auraTermPath(" rizz & roll "), "/lab/aura/rizz%20%26%20roll")
})

test("Aura route params are decoded once before fitting", () => {
  assert.equal(decodeAuraTerm("ceo%20of%20..."), "ceo of ...")
  assert.equal(decodeAuraTerm("literal%2520text"), "literal%20text")
  assert.equal(decodeAuraTerm("broken%2"), "broken%2")
})
