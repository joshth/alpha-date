import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
const ids = ["brainrot", "brain rot", "skibidi", "rizz", "lonely"]
const graph = {
  nodes: ids.map((id, i) => ({ id, label: id, kind: i < 3 ? "suggestion" : "lexicon", count: [5, 2, 3, 0, 0][i] })),
  edges: [
    { id: "e1", source: "brainrot", target: "brain rot", score: 1, reason: "same_key" },
    { id: "e2", source: "brainrot", target: "skibidi", score: 0.62, reason: "trigram" },
    { id: "e3", source: "rizz", target: "lonely", score: 0.4, reason: "stem" },
  ],
}
const positions = Object.fromEntries(ids.map((id, i) => [id, { x: 60 + i * 100, y: 80 + i * 50, r: 12 }]))
const out = (selectedId: string | null) => JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { GraphView, GraphLegend } = require("./components/aura/similarity-graph.tsx");
  globalThis.React = React;
  const p = ${JSON.stringify({ graph, positions, selectedId, threshold: 0.5, size: { width: 640, height: 400 } })};
  console.log(JSON.stringify({ view: renderToStaticMarkup(React.createElement(GraphView, p)), legend: renderToStaticMarkup(React.createElement(GraphLegend)) }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as { view: string; legend: string }
const group = (html: string, id: string) => html.match(new RegExp(`<g[^>]*data-node-id="${id}"[\\s\\S]*?</g>`))![0]
const line = (html: string, id: string) => html.match(new RegExp(`<line[^>]*data-edge-id="${id}"[^>]*>`))![0]

test("GraphView renders a labelled svg group with circle, button role and label per node", () => {
  const { view } = out("brainrot")
  assert.match(view, /<svg[^>]*role="group"[^>]*aria-label="Similarity graph"[^>]*viewBox="0 0 640 400"/)
  const g = group(view, "brainrot")
  assert.match(g, /<circle[^>]*\br="12"/)
  assert.match(g, /role="button"[^>]*aria-label="brainrot, suggestion, 5 submissions, 2 matches"|aria-label="brainrot, suggestion, 5 submissions, 2 matches"[^>]*role="button"/)
  assert.match(g, /<text[^>]*>brainrot<\/text>/)
  assert.equal(view.split("data-node-id=").length, 6)
  assert.doesNotMatch(view, /<animate/)
})

test("roving tabindex: selected node, else first node, is the only tab stop", () => {
  for (const [sel, stop] of [["skibidi", "skibidi"], [null, "brainrot"]] as const) {
    const v = out(sel).view
    assert.equal((v.match(/tabindex="0"/g) ?? []).length, 1)
    assert.match(group(v, stop), /tabindex="0"/)
    assert.match(group(v, "rizz"), /tabindex="-1"/)
  }
})

test("edges at the threshold are lines dashed by reason; weaker edges are not drawn", () => {
  const { view } = out(null)
  assert.doesNotMatch(view, /data-edge-id="e3"/)
  assert.doesNotMatch(line(view, "e1"), /stroke-dasharray="[^"]*\d/)
  assert.match(line(view, "e2"), /stroke-dasharray="6 4"/)
})

test("selecting dims unconnected nodes and presses the selected one", () => {
  const { view } = out("brainrot")
  assert.match(group(view, "brainrot"), /aria-pressed="true"/)
  assert.match(group(view, "rizz"), /opacity="0\.25"/)
  for (const id of ["skibidi", "brain rot"]) assert.doesNotMatch(group(view, id), /opacity="0\.25"/)
})

test("GraphLegend lists three edge types with dash swatches matching the edges", () => {
  const { legend } = out(null)
  assert.match(legend, /<ul[^>]*aria-label="Edge types"/)
  const items = legend.match(/<li[\s\S]*?<\/li>/g)!
  assert.equal(items.length, 3)
  ;[["Same key", ""], ["Trigram", "6 4"], ["Stem", "2 3"]].forEach(([t, d], i) => {
    assert.match(items[i], new RegExp(t))
    assert.match(items[i], /<svg[^>]*aria-hidden="true"/)
    if (d) assert.match(items[i], new RegExp(`stroke-dasharray="${d}"`))
  })
})
