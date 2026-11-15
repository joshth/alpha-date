import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const ids = ["brainrot", "brain rot", "skibidi"]
const graph = {
  nodes: ids.map((id, i) => ({ id, label: id, kind: i < 2 ? "suggestion" : "lexicon", count: [5, 2, 0][i] })),
  edges: [{ id: "e1", source: "brainrot", target: "brain rot", score: 1, reason: "same_key" }, { id: "e2", source: "brainrot", target: "skibidi", score: 0.62, reason: "trigram" }],
}
const positions = Object.fromEntries(ids.map((id, i) => [id, { x: 60 + i * 100, y: 80 + i * 50, r: 12 }]))
const render = (extra: object) => (JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { GraphExplorerView } = require("./components/aura/similarity-graph-explorer.tsx");
  globalThis.React = React;
  const p = ${JSON.stringify({ graph, positions, threshold: 0.5, selectedId: "brainrot", showTable: false, quality: null, ...extra })};
  console.log(JSON.stringify({ html: r(React.createElement(GraphExplorerView, p)) }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as { html: string }).html

for (const showTable of [false, true]) {
  test(`Export sits in the controls row with Show as table (showTable=${showTable})`, () => {
    const html = render({ showTable })
    const head = html.split(showTable ? "<table" : '<svg role="group"')[0]
    assert.ok(head.length < html.length, "split marker found")
    assert.match(head, /aria-haspopup="true"/)
    assert.ok(head.includes("Export"))
    assert.ok(head.includes("Show as table"))
  })
}

test("source wiring: ExportMenu props, PNG only in graph view, ref'd wrapper", () => {
  const src = readFileSync("components/aura/similarity-graph-explorer.tsx", "utf8")
  for (const s of ["<ExportMenu", 'filename="similarity-clusters"', "columns={CLUSTER_COLUMNS}", "rows={clusterRows(graph, threshold)}", "ref={graphRef}", `querySelector<SVGSVGElement>('svg[aria-label="Similarity graph"]')`]) assert.ok(src.includes(s), s)
  assert.match(src, /getSvg=\{showTable \? undefined/)
})
