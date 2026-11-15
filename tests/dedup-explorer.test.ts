import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { mergeCount } from "@/lib/dedup/nav"

const ids = ["brainrot", "brain rot", "skibidi"]
const graph = {
  nodes: ids.map((id, i) => ({ id, label: id, kind: i < 2 ? "suggestion" : "lexicon", count: [5, 2, 0][i] })),
  edges: [{ id: "e1", source: "brainrot", target: "brain rot", score: 1, reason: "same_key" }, { id: "e2", source: "brainrot", target: "skibidi", score: 0.62, reason: "trigram" }],
}
const positions = Object.fromEntries(ids.map((id, i) => [id, { x: 60 + i * 100, y: 80 + i * 50, r: 12 }]))
const render = (extra: object) => JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { GraphExplorerView, defaultShowTable } = require("./components/aura/similarity-graph-explorer.tsx");
  globalThis.React = React;
  const p = ${JSON.stringify({ graph, positions, threshold: 0.5, selectedId: "brainrot", showTable: false, quality: { precision: 2 / 3, recall: 1, cases: 8 }, ...extra })};
  console.log(JSON.stringify({ html: r(React.createElement(GraphExplorerView, p)), d: [375, 768, 1280].map(defaultShowTable) }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as { html: string; d: boolean[] }

test("slider, output, live counter and toggle", () => {
  const { html } = render({})
  const s = html.match(/<[^>]*role="slider"[^>]*>/)?.[0] ?? ""
  for (const a of ['aria-label="Match threshold"', 'aria-valuemin="0.3"', 'aria-valuemax="1"']) assert.ok(s.includes(a), a) // Radix adds aria-valuenow only after mount; the value is in the <output> below and checked in the browser
  assert.match(html, /<output(?=[^>]*font-mono)(?=[^>]*tabular-nums)[^>]*>0\.50<\/output>/)
  assert.match(html, new RegExp(`aria-live="polite"[^>]*>[^<]*${mergeCount(graph as any, 0.5)} merges at this threshold`))
  assert.match(html, /<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*>Show as table<\/button>/)
  assert.ok(html.includes("Changing the threshold never changes stored data."))
})

test("quality line, n/a and empty state", () => {
  assert.ok(render({}).html.includes("Merge precision 0.67 · recall 1.00 on 8 golden cases"))
  assert.ok(render({ quality: { precision: null, recall: null, cases: 8 } }).html.includes("n/a"))
  const h = render({ quality: null }).html
  assert.ok(h.includes("No golden dedup cases loaded.") && !h.includes("Merge precision"))
})

test("table vs graph view", () => {
  const t = render({ showTable: true }).html, g = render({ showTable: false }).html
  assert.match(t, /<caption/)
  assert.doesNotMatch(t, /<svg[^>]*role="group"/)
  assert.match(g, /<svg[^>]*role="group"/)
  assert.match(g, /<ul[^>]*aria-label="Edge types"/)
  assert.doesNotMatch(g, /<caption/)
  assert.match(g, /<section/)
})

test("defaultShowTable below 768 only", () => assert.deepEqual(render({}).d, [true, false, false]))

test("presentational: no server code or network", () => {
  const src = readFileSync("components/aura/similarity-graph-explorer.tsx", "utf8")
  for (const bad of ["use server", "recordSuggestion", "fetch("]) assert.ok(!src.includes(bad), bad)
})
