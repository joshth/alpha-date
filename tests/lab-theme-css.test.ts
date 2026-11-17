import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync("app/globals.css", "utf8").replace(/\r\n/g, "\n")
const MEDIA = "@media (prefers-color-scheme: light)"

const body = (src: string, selector: string) => {
  const i = src.indexOf(selector + " {")
  return i < 0 ? "" : src.slice(i + selector.length + 2, src.indexOf("}", i))
}
const tokens = (b: string) => Object.fromEntries([...b.matchAll(/(--lab-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))

const base = css.match(/(?:^|\n)\.lab \{([^}]*)\}/)?.[1] ?? ""
const baseTokens = tokens(base)
const mediaPart = css.split(MEDIA)[1] ?? ""
const mediaBlock = body(mediaPart, ":root:not([data-theme]) .lab")
const darkBlock = body(css, '[data-theme="dark"] .lab')
const lightBlock = body(css, '[data-theme="light"] .lab')

test("explicit dark block repeats the base dark tokens and sets color-scheme: dark", () => {
  assert.ok(Object.keys(baseTokens).length > 10, "no base .lab block")
  assert.ok(darkBlock, 'no [data-theme="dark"] .lab block')
  assert.deepEqual(tokens(darkBlock), baseTokens)
  assert.match(darkBlock, /color-scheme:\s*dark\s*;/)
})

test("explicit light block repeats every token the media light block defines and sets color-scheme: light", () => {
  const want = tokens(mediaBlock)
  assert.ok(Object.keys(want).length >= 10, "no media light block")
  assert.ok(lightBlock, 'no [data-theme="light"] .lab block')
  const got = tokens(lightBlock)
  for (const [k, v] of Object.entries(want)) assert.equal(got[k], v, k)
  assert.match(lightBlock, /color-scheme:\s*light\s*;/)
})

test("OS light preference only applies when no explicit data-theme is set", () => {
  assert.ok(css.includes(MEDIA), "media query removed")
  assert.ok(mediaBlock, "media block must be scoped to :root:not([data-theme]) .lab")
  assert.match(mediaBlock, /color-scheme:\s*light\s*;/)
  assert.ok(!/@media[^{]*\{\s*\.lab \{/.test(css), "unscoped .lab inside the media query")
})

test("base .lab block also declares color-scheme: dark and stays the first .lab block", () => {
  assert.match(base, /color-scheme:\s*dark\s*;/)
  assert.ok(css.indexOf("\n.lab {") < css.indexOf('[data-theme="dark"] .lab {'))
})
