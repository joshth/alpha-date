import { test } from "node:test"
import assert from "node:assert/strict"
import {
  AURA_SORT_STORAGE_KEY, DEFAULT_AURA_SORT, parseAuraSortPref, readAuraSortPref, writeAuraSortPref,
} from "../components/aura/sort-pref"

const boom = () => { throw new Error("denied") }

test("storage key is lab-aura-sort and the default is term ascending", () => {
  assert.equal(AURA_SORT_STORAGE_KEY, "lab-aura-sort")
  assert.deepEqual(DEFAULT_AURA_SORT, { key: "term", direction: "ascending" })
})

test("parseAuraSortPref keeps every valid column and direction", () => {
  for (const key of ["term", "aura", "confidence"] as const)
    for (const direction of ["ascending", "descending"] as const)
      assert.deepEqual(parseAuraSortPref(JSON.stringify({ key, direction })), { key, direction })
})

test("parseAuraSortPref falls back to the default for missing or invalid values", () => {
  for (const bad of [
    null, undefined, "", "term", "not json", "{", "null", "[]", "42", 1, {},
    '{"key":"term"}', '{"direction":"ascending"}',
    '{"key":"stage","direction":"ascending"}', '{"key":"term","direction":"up"}',
    '{"key":"TERM","direction":"ascending"}', '{"key":1,"direction":2}',
  ]) assert.deepEqual(parseAuraSortPref(bad), DEFAULT_AURA_SORT)
})

test("readAuraSortPref reads the stored value under the storage key", () => {
  const keys: string[] = []
  const store = { getItem: (k: string) => (keys.push(k), '{"key":"confidence","direction":"descending"}') }
  assert.deepEqual(readAuraSortPref(store), { key: "confidence", direction: "descending" })
  assert.deepEqual(keys, ["lab-aura-sort"])
})

test("readAuraSortPref falls back to the default for null storage, empty, garbage and a throwing getItem", () => {
  assert.deepEqual(readAuraSortPref(null), DEFAULT_AURA_SORT)
  assert.deepEqual(readAuraSortPref({ getItem: () => null }), DEFAULT_AURA_SORT)
  assert.deepEqual(readAuraSortPref({ getItem: () => "purple" }), DEFAULT_AURA_SORT)
  assert.deepEqual(readAuraSortPref({ getItem: boom }), DEFAULT_AURA_SORT)
})

test("writeAuraSortPref stores the sort under the key, round-trips, and never throws", () => {
  const data = new Map<string, string>()
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  writeAuraSortPref(store, { key: "aura", direction: "descending" })
  assert.deepEqual([...data.keys()], ["lab-aura-sort"])
  assert.deepEqual(readAuraSortPref(store), { key: "aura", direction: "descending" })
  assert.doesNotThrow(() => writeAuraSortPref(null, DEFAULT_AURA_SORT))
  assert.doesNotThrow(() => writeAuraSortPref({ setItem: boom }, DEFAULT_AURA_SORT))
})

// No DOM test library in this repo, so the wiring is checked from the component source.
import { readFileSync } from "node:fs"
const tab = readFileSync("components/aura/lifecycle-tab.tsx", "utf8")

test("the lifecycle table restores the saved sort after mount and saves every change", () => {
  assert.match(tab, /from "\.\/sort-pref"/)
  assert.match(tab, /useEffect\(\(\) => \{[^}]*readAuraSortPref\(safeLocalStorage\(\)\)/)
  assert.match(tab, /writeAuraSortPref\(safeLocalStorage\(\),/)
  assert.doesNotMatch(tab, /type DashboardSortKey =/)
})
