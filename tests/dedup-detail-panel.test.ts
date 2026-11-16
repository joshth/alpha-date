import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const graph = {
  nodes: [
    { id: "brainrot", label: "brainrot", kind: "suggestion", count: 5 },
    { id: "brain rot", label: "brain rot", kind: "suggestion", count: 2 },
    { id: "skibidi", label: "skibidi", kind: "suggestion", count: 3 },
    { id: "rizz", label: "rizz", kind: "lexicon", count: 0 },
  ],
  edges: [
    { id: "e1", source: "brainrot", target: "brain rot", score: 1, reason: "same_key" },
    { id: "e2", source: "brainrot", target: "skibidi", score: 0.62, reason: "trigram", signals: { trigram: 0.62, stem: true } },
    { id: "e3", source: "rizz", target: "brainrot", score: 0.4, reason: "stem", signals: { trigram: 0.4, stem: false } },
  ],
}
const render = (id: string | null, threshold: number) => JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { NodePanel } = require("./components/aura/similarity-graph.tsx");
  globalThis.React = React;
  console.log(JSON.stringify(renderToStaticMarkup(React.createElement(NodePanel, ${JSON.stringify({ graph, id, threshold })}))));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as string

test("NodePanel shows heading, kind and submissions", () => {
  const html = render("brainrot", 0.3)
  assert.match(html, /<section[^>]*aria-label="Details for brainrot"/)
  assert.match(html, /<h2[^>]*>brainrot<\/h2>/)
  assert.match(html, /suggestion/)
  assert.match(html, /5 submissions/)
})

test("NodePanel lists each connection with label, mono score, reason and signals", () => {
  const items = render("brainrot", 0.3).match(/<li[\s\S]*?<\/li>/g)!
  assert.equal(items.length, 3)
  const by = (label: string) => items.find((i) => i.includes(label))!
  assert.match(by("skibidi"), /<[^>]*font-mono tabular-nums[^>]*>0\.62</)
  assert.match(by("skibidi"), /trigram/)
  assert.match(by("skibidi"), /trigram 0\.62, stem match/)
  assert.match(by("rizz"), /trigram 0\.40, no stem match/)
  assert.match(by("brain rot"), /1\.00/)
  assert.doesNotMatch(by("brain rot"), /stem match|trigram 1/)
})

test("NodePanel hides connections below the threshold", () => {
  const html = render("brainrot", 0.5)
  assert.equal((html.match(/<li/g) ?? []).length, 2)
  assert.doesNotMatch(html, /rizz/)
})

test("NodePanel with no selection prompts", () => {
  assert.match(render(null, 0.5), /Select a word to see what it merges with\./)
})
