import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mergeCount } from "@/lib/dedup/nav"

const ids = ["rizzler", "huzz", "tuff"]
const graph = {
  nodes: ids.map((id, i) => ({ id, label: id, kind: "suggestion", count: [5, 3, 2][i] })),
  edges: [{ id: "e1", source: "rizzler", target: "tuff", score: 0.62, reason: "trigram" }],
}
const positions = Object.fromEntries(ids.map((id, i) => [id, { x: 60 + i * 100, y: 80 + i * 50, r: 12 }]))
const semanticEdges = [{ id: "huzz|rizzler", source: "rizzler", target: "huzz", score: 0.95, reason: "semantic" }]
const run = (comp: string, props: object) => JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const g = require("./components/aura/similarity-graph.tsx"), x = require("./components/aura/similarity-graph-explorer.tsx");
  globalThis.React = React;
  console.log(JSON.stringify(r(React.createElement(({ GraphView: g.GraphView, GraphLegend: g.GraphLegend, Explorer: x.GraphExplorerView })[${JSON.stringify(comp)}], ${JSON.stringify(props)}))));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as string
const view = (extra: object) => run("GraphView", { graph, positions, selectedId: null, threshold: 0.5, size: { width: 640, height: 400 }, ...extra })
const explorer = (extra: object) => run("Explorer", { graph, positions, threshold: 0.5, selectedId: null, showTable: false, quality: null, ...extra })
const lis = (h: string) => h.match(/<li[\s\S]*?<\/li>/g)!

test("GraphView draws a double line per semantic edge, none without the prop", () => {
  const g = view({ semanticEdges }).match(/<g[^>]*data-edge-kind="semantic"[^>]*>[\s\S]*?<\/g>/)![0]
  assert.match(g, /data-edge-id="huzz\|rizzler"/)
  assert.match(g, /aria-hidden="true"/)
  assert.equal(g.match(/<line/g)!.length, 2)
  assert.doesNotMatch(g, /stroke="#|stroke-dasharray="[^"]*\d/)
  assert.doesNotMatch(view({}), /data-edge-kind="semantic"/)
})

test("GraphLegend: three items by default, a fourth double-line item when semantic", () => {
  assert.equal(lis(run("GraphLegend", {})).length, 3)
  const items = lis(run("GraphLegend", { semantic: true }))
  assert.equal(items.length, 4)
  assert.match(items[3], /Meaning \(reviewer hint\)/)
  assert.equal(items[3].match(/<line/g)!.length, 2)
})

test("explorer toggle, note, and hints when on; merge counter unchanged", () => {
  const off = explorer({ semanticEdges }), on = explorer({ semanticOn: true, semanticEdges })
  assert.match(off, /<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*>Show meaning matches<\/button>/)
  assert.match(on, /<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*>Show meaning matches<\/button>/)
  for (const h of [off, on]) assert.ok(h.includes("Meaning matches are hints for a reviewer. They never merge rows."))
  assert.doesNotMatch(off, /data-edge-kind="semantic"/)
  assert.match(on, /data-edge-kind="semantic"/)
  assert.equal(lis(on.match(/<ul[^>]*aria-label="Edge types"[\s\S]*?<\/ul>/)![0]).length, 4)
  for (const h of [off, on]) assert.match(h, new RegExp(`${mergeCount(graph as any, 0.5)} merges at this threshold`))
})
