import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const savings = { rawRows: 5, distinctKeys: 3, merged: 2, reductionPct: 40, reviewItemsSaved: 2, storageSavedBytes: 1234, submissions: 12, estimate: { minutesSaved: 4, assumption: "2 min per review" } }
const html: Record<string, string> = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { DedupResult, DedupTab } = require("./components/aura/dedup-tab.tsx");
  globalThis.React = React;
  const s = ${JSON.stringify(savings)};
  console.log(JSON.stringify({
    full: r(React.createElement(DedupResult, { savings: s, minutesPerReview: 2 })),
    zero: r(React.createElement(DedupResult, { savings: { ...s, rawRows: 0 }, minutesPerReview: 2 })),
    tab: r(React.createElement(DedupTab, { savingsAction: async () => s })),
  }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))

test("stat list: dt labels and mono tabular dd values", () => {
  const h = html.full
  assert.match(h, /<dl/)
  const pairs: [string, string][] = [["Rows before", "5"], ["Distinct keys", "3"], ["Rows merged", "2"], ["Reduction", "40%"], ["Storage saved", "1.2 kB"], ["Review items saved", "2"]]
  for (const [t, v] of pairs) {
    assert.match(h, new RegExp(`<dt[^>]*>${t}</dt>`))
    assert.match(h, new RegExp(`<dt[^>]*>${t}</dt>\\s*<dd(?=[^>]*font-mono)(?=[^>]*tabular-nums)[^>]*>${v}</dd>`))
  }
})

test("estimate block is labelled, editable and states its baseline", () => {
  const h = html.full
  assert.match(h, /Estimate/)
  assert.ok(h.includes("4 min saved at 2 min per review"))
  const input = h.match(/<input[^>]*type="number"[^>]*>/)?.[0] ?? ""
  assert.ok(/min="0"/.test(input) && /value="2"/.test(input), input)
  const id = input.match(/id="([^"]+)"/)?.[1]
  assert.ok(id, "input has an id")
  assert.match(h, new RegExp(`<label[^>]*for="${id}"[^>]*>Minutes per review</label>`))
  assert.ok(h.includes("Baseline: exact match on trimmed lower case"))
})

test("zero state has a message and no dl", () => {
  assert.ok(html.zero.includes("No suggestions yet"))
  assert.doesNotMatch(html.zero, /<dl/)
})

test("tab renders the input and a live region, and fetches on mount", () => {
  assert.match(html.tab, /<input[^>]*type="number"/)
  assert.match(html.tab, /role="status"/)
  assert.match(readFileSync("components/aura/dedup-tab.tsx", "utf8"), /useEffect/)
})
