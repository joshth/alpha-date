import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { themeInitScript } from "../components/lab/theme"

// Runs the script against fakes; returns the data-theme attribute left on <html> (null = absent).
function run(stored: string | null | "throw", osLight = false, start: string | null = null) {
  let attr = start
  const sandbox = {
    localStorage: { getItem: (k: string) => { if (stored === "throw") throw new Error("denied"); return k === "lab-theme" ? stored : "x" } },
    matchMedia: (q: string) => ({ matches: q === "(prefers-color-scheme: light)" && osLight }),
    document: { documentElement: {
      setAttribute: (n: string, v: string) => { if (n === "data-theme") attr = v },
      removeAttribute: (n: string) => { if (n === "data-theme") attr = null },
      dataset: new Proxy({}, { set: (_t, p, v) => { if (p === "theme") attr = v; return true }, deleteProperty: (_t, p) => { if (p === "theme") attr = null; return true } }),
    } },
  }
  vm.runInNewContext(themeInitScript(), sandbox)
  return attr
}

test("themeInitScript is a self-contained IIFE string", () => {
  const s = themeInitScript()
  assert.equal(typeof s, "string")
  assert.match(s, /^\s*\(/)
  assert.ok(s.includes("lab-theme") && s.includes("prefers-color-scheme: light"))
  assert.ok(s.includes("data-theme") || s.includes("dataset"))
  assert.ok(s.length < 600, "keep it tiny")
})

test("explicit light and dark set data-theme, whatever the OS says", () => {
  for (const os of [true, false]) {
    assert.equal(run("light", os), "light")
    assert.equal(run("dark", os), "dark")
  }
})

test("system, empty, garbage and throwing storage leave data-theme unset (and clear a stale one)", () => {
  for (const v of ["system", null, "purple", "throw"] as const) {
    assert.equal(run(v), null, String(v))
    assert.equal(run(v, true, "dark"), null, `${v} clears stale`)
  }
})

test("lab layout inlines the script; root layout suppresses the hydration warning on <html>", () => {
  const lab = readFileSync("app/lab/layout.tsx", "utf8")
  assert.ok(lab.includes("themeInitScript"))
  assert.match(lab, /<script[^>]*dangerouslySetInnerHTML=\{\{\s*__html:\s*themeInitScript\(\)\s*\}\}/)
  assert.match(readFileSync("app/layout.tsx", "utf8"), /<html[^>]*suppressHydrationWarning/)
})
