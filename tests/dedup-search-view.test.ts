import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const render = (props: object) => (JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { DedupSearchView } = require("./components/aura/dedup-search.tsx");
  globalThis.React = React;
  console.log(JSON.stringify({ html: r(React.createElement(DedupSearchView, ${JSON.stringify(props)})) }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as { html: string }).html

test("shows a labelled input, the key and each match with its reason and score", () => {
  const html = render({ text: "ろくななです", result: { key: "ろくななです", matches: [{ candidate: "六七", score: 0.58, reason: "stem", label: "Same stem" }] } })
  assert.match(html, /<label[^>]*for="([^"]+)"[^>]*>Suggestion<\/label>/)
  assert.match(html, /<input[^>]*value="ろくななです"/)
  assert.match(html, /key:[^<]*<[^>]*font-mono[^>]*>ろくななです</)
  assert.match(html, /<li[^>]*>.*六七.*Same stem.*0\.58.*<\/li>/)
})

test("says so when nothing matches, and shows nothing for empty input", () => {
  assert.ok(render({ text: "xyzzy", result: { key: "xyzzy", matches: [] } }).includes("No match: this would be a new term"))
  const empty = render({ text: "", result: { key: "", matches: [] } })
  assert.ok(!empty.includes("No match") && !empty.includes("key:"))
})
