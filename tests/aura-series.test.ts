import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

// recharts cannot load under the react-server condition, so import in a child process.
type S = { key: string; label: string; color: string; dash: string; shape: string }
const m = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  globalThis.React = require("react");
  const m = require("./components/aura/lifecycle-charts.tsx");
  console.log(JSON.stringify({ MAIN_SERIES: m.MAIN_SERIES, SHARE_SERIES: m.SHARE_SERIES, FEEDBACK_SERIES: m.FEEDBACK_SERIES, CHART_REFS: m.CHART_REFS }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as
  { MAIN_SERIES: S[]; SHARE_SERIES: S[]; FEEDBACK_SERIES: S[]; CHART_REFS: { peakLine: number } }
const { MAIN_SERIES, SHARE_SERIES, FEEDBACK_SERIES, CHART_REFS } = m

const all = { MAIN_SERIES, SHARE_SERIES, FEEDBACK_SERIES }
const keys = (s: { key: string }[]) => s.map((x) => x.key)

test("series keys and shapes", () => {
  assert.deepEqual(keys(MAIN_SERIES), ["interest", "fitted"])
  assert.equal(MAIN_SERIES[0].shape, "dot")
  assert.equal(MAIN_SERIES[1].shape, "line")
  assert.deepEqual(keys(SHARE_SERIES), ["susceptible", "infected", "recovered"])
  assert.deepEqual(keys(FEEDBACK_SERIES), ["feedback"])
})

for (const [name, series] of Object.entries(all)) {
  test(`${name}: dashes distinct (not colour alone), tokens, labels`, () => {
    assert.equal(new Set(series.map((s) => s.dash)).size, series.length)
    for (const s of series) {
      assert.match(s.color, /^hsl\(var\(--lab-[a-z-]+\)\)$/)
      assert.ok(s.label.trim().length > 0)
    }
  })
}

test("CHART_REFS peak line", () => {
  assert.equal(CHART_REFS.peakLine, 0.8)
})
