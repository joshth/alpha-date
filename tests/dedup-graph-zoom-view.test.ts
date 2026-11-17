import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const graph = { nodes: [{ id: "a", label: "a", kind: "suggestion", count: 1 }], edges: [] }
const positions = { a: { x: 100, y: 100, r: 12 } }
const render = (extra: object) => execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { GraphView } = require("./components/aura/similarity-graph.tsx");
  globalThis.React = React;
  console.log(r(React.createElement(GraphView, ${JSON.stringify({ graph, positions, selectedId: null, threshold: 0.5, size: { width: 640, height: 400 }, ...extra })})));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })

test("GraphView uses the zoomed view for its viewBox", () => {
  assert.match(render({ view: { x: 160, y: 100, w: 320, h: 200 } }), /viewBox="160 100 320 200"/)
})

test("GraphView keeps the full viewBox when no view is given", () => {
  assert.match(render({}), /viewBox="0 0 640 400"/)
})


test("clicking graph space clears selection but clicking a node does not", () => {
  const result = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    globalThis.React = require("react");
    const { GraphView } = require("./components/aura/similarity-graph.tsx");
    const selected = [];
    const svg = GraphView({ ...${JSON.stringify({ graph, positions, selectedId: "a", threshold: 0.5 })}, onSelect: (id) => selected.push(id) });
    svg.props.onClick({ target: { closest: () => null } });
    svg.props.onClick({ target: { closest: () => ({}) } });
    console.log(JSON.stringify(selected));
  `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })
  assert.deepEqual(JSON.parse(result), [null])
})
