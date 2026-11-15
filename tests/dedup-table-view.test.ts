import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const nodes = [
  { id: "brainrot", label: "brainrot", kind: "suggestion", count: 5 },
  { id: "brain rot", label: "brain rot", kind: "suggestion", count: 2 },
  { id: "skibidi", label: "skibidi", kind: "suggestion", count: 3 },
  { id: "rizz", label: "rizz", kind: "lexicon", count: 0 },
  { id: "lonely", label: "lonely", kind: "suggestion", count: 1 },
]
const edges = [
  { id: "e1", source: "brainrot", target: "brain rot", score: 1, reason: "same_key" },
  { id: "e2", source: "skibidi", target: "rizz", score: 0.62, reason: "trigram", signals: { trigram: 0.62, stem: false } },
]
const render = (threshold: number, e = edges) => JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { ClusterTable } = require("./components/aura/similarity-graph.tsx");
  globalThis.React = React;
  console.log(JSON.stringify(renderToStaticMarkup(React.createElement(ClusterTable, ${JSON.stringify({ graph: { nodes, edges: e }, threshold })}))));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as string

test("ClusterTable has a caption and column headers", () => {
  const html = render(0.5)
  assert.match(html, /<caption[^>]*>Clusters of similar words at threshold 0\.50<\/caption>/)
  for (const h of ["Cluster", "Word", "Kind", "Submissions"]) assert.match(html, new RegExp(`<th[^>]*scope="col"[^>]*>${h}</th>`))
})

test("ClusterTable has one numbered row per clustered word, singletons excluded", () => {
  const rows = render(0.5).match(/<tr[\s\S]*?<\/tr>/g)!.filter((r) => !r.includes("<th"))
  assert.equal(rows.length, 4)
  assert.match(rows[0], /<t[dh][^>]*>1<\/t[dh]>/)
  assert.match(rows[2], /<t[dh][^>]*>2<\/t[dh]>/)
  assert.ok(rows.some((r) => /skibidi/.test(r) && /suggestion/.test(r) && />3</.test(r)))
  assert.ok(!rows.some((r) => /lonely/.test(r)))
})

test("ClusterTable says so when nothing is joined", () => {
  const html = render(0.9, [])
  assert.match(html, /No words are joined at this threshold\./)
  assert.doesNotMatch(html, /<table/)
})
