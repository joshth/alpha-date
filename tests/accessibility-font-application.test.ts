import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync("app/globals.css", "utf8")

test("accessibility font choices override font-sans app layouts", () => {
  for (const font of ["atkinson", "opendyslexic"]) {
    assert.match(
      css,
      new RegExp(`body\\[data-accessibility-font="${font}"\\][\\s\\S]*?body\\[data-accessibility-font="${font}"\\] \\.font-sans`),
      `${font} should apply to nested app layouts that set font-sans`,
    )
  }
})
