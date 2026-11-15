import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { auraTermPath } from "../lib/aura/term-route"

test("Aura term paths encode a trimmed term as one route segment", () => {
  assert.equal(auraTermPath(" rizz & roll "), "/lab/aura/rizz%20%26%20roll")
})
