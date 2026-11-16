import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { applyThemePref } from "../components/lab/theme"

// A fake <html> that records the attributes the toggle sets.
function fakeEl(start: Record<string, string> = {}) {
  const attrs = { ...start }
  return {
    attrs,
    setAttribute: (n: string, v: string) => void (attrs[n] = v),
    removeAttribute: (n: string) => void delete attrs[n],
  }
}

test("applyThemePref: light and dark set data-theme and the resolved theme, whatever the OS says", () => {
  for (const os of [true, false]) {
    const l = fakeEl()
    applyThemePref(l, "light", os)
    assert.deepEqual(l.attrs, { "data-theme": "light", "data-resolved-theme": "light" })
    const d = fakeEl()
    applyThemePref(d, "dark", os)
    assert.deepEqual(d.attrs, { "data-theme": "dark", "data-resolved-theme": "dark" })
  }
})

test("applyThemePref: system removes data-theme (so the CSS follows the OS) and records what the OS resolves to", () => {
  const a = fakeEl({ "data-theme": "dark" })
  applyThemePref(a, "system", true)
  assert.deepEqual(a.attrs, { "data-resolved-theme": "light" })
  const b = fakeEl({ "data-theme": "light" })
  applyThemePref(b, "system", false)
  assert.deepEqual(b.attrs, { "data-resolved-theme": "dark" })
})

test("the Lab shell remembers the choice, applies it, and follows OS changes while on System", () => {
  const src = readFileSync("components/lab/shell-client.tsx", "utf8")
  for (const name of ["readThemePref", "writeThemePref", "applyThemePref", "themePref", "onThemeChange"]) assert.ok(src.includes(name), name)
  assert.match(src, /prefers-color-scheme: light/)
  assert.match(src, /addEventListener\("change"/)
  assert.match(src, /removeEventListener\("change"/)
})
