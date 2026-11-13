import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const table = {
  caption: "Weekly interest and fit",
  columns: [{ key: "week", label: "Week" }, { key: "interest", label: "Interest", numeric: true }],
  rows: [{ week: "2026-10-25", interest: 0.123456 }, { week: "2026-11-01", interest: 0.5 }],
}
let cached: Record<string, string> | undefined
const run = () => (cached ??= JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { ChartPanel } = require("./components/aura/chart-panel.tsx");
  globalThis.React = React;
  const out = {};
  for (const [k, d] of [["hidden", false], ["shown", true]])
    out[k] = renderToStaticMarkup(React.createElement(ChartPanel,
      { title: "Interest over time", summary: "Interest peaked in October.", table: ${JSON.stringify(table)}, defaultShowTable: d },
      React.createElement("svg", { "data-testid": "the-chart" })));
  console.log(JSON.stringify(out));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })))

test("ChartPanel title and summary linked to the chart region", () => {
  const html = run().hidden
  assert.match(html, /<h3[^>]*>Interest over time<\/h3>/)
  const p = html.match(/<p[^>]*id="([^"]+)"[^>]*>Interest peaked in October\.<\/p>/)
  assert.ok(p, "summary <p> with id")
  assert.match(html, new RegExp(`(<figure|role="figure")[^>]*aria-describedby="${p![1]}"`))
})

test("ChartPanel hidden: chart shown, toggle unpressed, no table", () => {
  const html = run().hidden
  assert.match(html, /<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*>[^]*?Show as table/)
  assert.ok(html.includes("the-chart"))
  assert.doesNotMatch(html, /<table/)
})

test("ChartPanel shown: accessible table, no chart", () => {
  const html = run().shown
  assert.match(html, /aria-pressed="true"/)
  assert.ok(!html.includes("the-chart"))
  assert.match(html, /<caption[^>]*>Weekly interest and fit<\/caption>/)
  assert.equal((html.match(/<th[^>]*scope="col"/g) ?? []).length, 2)
  assert.match(html, /<th[^>]*scope="col"[^>]*>Interest<\/th>/)
  const body = html.match(/<tbody[^>]*>([^]*)<\/tbody>/)![1]
  assert.equal((body.match(/<tr/g) ?? []).length, 2)
})

test("ChartPanel numeric cells are mono tabular and rounded to 3 decimals", () => {
  const html = run().shown
  assert.match(html, /<td[^>]*class="[^"]*font-mono[^"]*tabular-nums[^"]*"[^>]*>0\.123<\/td>|<td[^>]*class="[^"]*tabular-nums[^"]*font-mono[^"]*"[^>]*>0\.123<\/td>/)
  assert.match(html, /<td[^>]*font-mono[^>]*>0\.5<\/td>/)
  assert.doesNotMatch(html, /0\.1234/)
})
