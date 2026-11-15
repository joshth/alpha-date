import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const ids = ["brainrot", "brain rot", "skibidi"]
const graph = {
  nodes: ids.map((id, i) => ({ id, label: id, kind: i < 2 ? "suggestion" : "lexicon", count: [5, 2, 0][i] })),
  edges: [{ id: "e1", source: "brainrot", target: "brain rot", score: 1, reason: "same_key" }],
}
const positions = Object.fromEntries(ids.map((id, i) => [id, { x: 60 + i * 100, y: 80 + i * 50, r: 12 }]))
const table = { caption: "c", columns: [{ key: "week", label: "Week" }], rows: [{ week: "w" }] }
const out = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { ChartPanel } = require("./components/aura/chart-panel.tsx");
  const { GraphExplorerView } = require("./components/aura/similarity-graph-explorer.tsx");
  globalThis.React = React;
  const panel = (extra) => r(React.createElement(ChartPanel, { title: "Interest", summary: "s", table: ${JSON.stringify(table)}, ...extra }, React.createElement("p", null, "CHART")));
  const base = ${JSON.stringify({ graph, positions, threshold: 0.5, selectedId: "brainrot", quality: null })};
  const ex = (showTable) => r(React.createElement(GraphExplorerView, { ...base, showTable }));
  console.log(JSON.stringify({ withInfo: panel({ infoId: "interest" }), without: panel({}), table: ex(true), graph: ex(false) }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as Record<string, string>

test("ChartPanel renders the info button in the header row", () => {
  const h = out.withInfo
  const label = h.indexOf('aria-label="About this chart: Search interest and fitted curve"')
  assert.ok(label > 0)
  assert.ok(label < h.indexOf("Export"))
  assert.ok(label < h.indexOf("<p id="))
  assert.ok(!out.without.includes("About this chart"))
  assert.match(readFileSync("components/aura/chart-panel.tsx", "utf8"), /infoId\?: GraphInfoId/)
})

test("lifecycle charts pass infoId to all three panels", () => {
  const src = readFileSync("components/aura/lifecycle-charts.tsx", "utf8")
  assert.ok(src.includes('infoId="interest"'))
  assert.ok(src.includes("infoId={infoId}")) // the share() helper forwards its id
  for (const id of ["shares", "feedback"]) assert.match(src, new RegExp(`share\\("[^"]+", \\w+, "[^"]+", "${id}"\\)`), id)
})

test("similarity explorer has the info button in both views", () => {
  assert.ok(readFileSync("components/aura/similarity-graph-explorer.tsx", "utf8").includes('<GraphInfoButton id="similarity"'))
  for (const k of ["table", "graph"]) assert.ok(out[k].includes('aria-label="About this chart: Similarity graph"'), k)
})
