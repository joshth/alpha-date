import { test } from "node:test"
import assert from "node:assert/strict"
import {
  THEME_STORAGE_KEY, parseThemePref, readThemePref, resolveTheme, writeThemePref,
} from "../components/lab/theme"

const boom = () => { throw new Error("denied") }

test("storage key is lab-theme", () => assert.equal(THEME_STORAGE_KEY, "lab-theme"))

test("parseThemePref keeps the three valid values and defaults everything else to system", () => {
  for (const p of ["light", "dark", "system"] as const) assert.equal(parseThemePref(p), p)
  for (const bad of [null, undefined, "", "LIGHT", "auto", 1, {}, ["dark"]]) assert.equal(parseThemePref(bad), "system")
})

test("resolveTheme: explicit choice wins, system follows the OS", () => {
  for (const os of [true, false]) {
    assert.equal(resolveTheme("light", os), "light")
    assert.equal(resolveTheme("dark", os), "dark")
  }
  assert.equal(resolveTheme("system", true), "light")
  assert.equal(resolveTheme("system", false), "dark")
})

test("readThemePref reads the stored value under the storage key", () => {
  const keys: string[] = []
  const store = (v: string | null) => ({ getItem: (k: string) => (keys.push(k), v) })
  assert.equal(readThemePref(store("dark")), "dark")
  assert.equal(readThemePref(store("light")), "light")
  assert.deepEqual(keys, ["lab-theme", "lab-theme"])
})

test("readThemePref falls back to system for null storage, empty, garbage and a throwing getItem", () => {
  assert.equal(readThemePref(null), "system")
  assert.equal(readThemePref({ getItem: () => null }), "system")
  assert.equal(readThemePref({ getItem: () => "purple" }), "system")
  assert.equal(readThemePref({ getItem: boom }), "system")
})

test("writeThemePref stores the pref under the key and never throws", () => {
  const calls: string[][] = []
  writeThemePref({ setItem: (k, v) => void calls.push([k, v]) }, "dark")
  assert.deepEqual(calls, [["lab-theme", "dark"]])
  assert.doesNotThrow(() => writeThemePref(null, "light"))
  assert.doesNotThrow(() => writeThemePref({ setItem: boom }, "light"))
})
