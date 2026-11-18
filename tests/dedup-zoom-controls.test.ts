import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const graph = { nodes: [{ id: "a", label: "a", kind: "suggestion", count: 1 }], edges: [] }
const positions = { a: { x: 100, y: 100, r: 12 } }
const render = (extra: object) => execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { GraphExplorerView } = require("./components/aura/similarity-graph-explorer.tsx");
  globalThis.React = React;
  console.log(r(React.createElement(GraphExplorerView, ${JSON.stringify({ graph, positions, threshold: 0.5, selectedId: null, showTable: false, quality: null, ...extra })})));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })

test("graph view has labelled zoom in, zoom out and reset buttons", () => {
  const html = render({})
  for (const name of ["Zoom in", "Zoom out", "Reset zoom"]) assert.match(html, new RegExp(`<button[^>]*type="button"[^>]*aria-label="${name}"`))
})

test("zoom controls are hidden in table view", () => {
  assert.doesNotMatch(render({ showTable: true }), /aria-label="Zoom in"/)
})

test("graph is drawn with the zoomed view", () => {
  assert.match(render({ view: { x: 160, y: 100, w: 320, h: 200 } }), /viewBox="160 100 320 200"/)
})
