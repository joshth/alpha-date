import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const table = {
  caption: "Weekly interest",
  columns: [{ key: "week", label: "Week" }, { key: "v", label: "Value", numeric: true }],
  rows: [{ week: "2026-01-04", v: 1.5 }],
}
const out = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { ChartPanel } = require("./components/aura/chart-panel.tsx");
  globalThis.React = React;
  const o = {};
  for (const [k, d] of [["hidden", false], ["shown", true]])
    o[k] = renderToStaticMarkup(React.createElement(ChartPanel,
      { title: "Interest", summary: "s", table: ${JSON.stringify(table)}, defaultShowTable: d },
      React.createElement("p", null, "CHART")));
  console.log(JSON.stringify(o));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as Record<string, string>

for (const [state, label, pressed] of [["hidden", "Show as table", "false"], ["shown", "Show as chart", "true"]]) {
  test(`header row has Export and toggle (${state})`, () => {
    const head = out[state].split("<p id=")[0]
    assert.match(head, /aria-haspopup="true"/)
    assert.ok(head.includes("Export"))
    assert.match(head, new RegExp(`aria-pressed="${pressed}"[^>]*>${label}<`))
  })
}

test("source wiring: ExportMenu props, PNG only in chart view, ref'd figure", () => {
  const src = readFileSync("components/aura/chart-panel.tsx", "utf8")
  assert.match(src, /import \{ ExportMenu \}/)
  for (const s of ["filename={title}", "columns={table.columns}", "rows={table.rows}", '<figure ref=', 'querySelector<SVGSVGElement>("svg.recharts-surface")']) assert.ok(src.includes(s), s)
  assert.match(src, /getSvg=\{showTable \? undefined/)
})
