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

test("offers all five Chinese number examples with their meanings", () => {
  const html = render({ text: "521", result: { key: "我爱你", matches: [{ candidate: "我爱你", score: 1, reason: "same_key", label: "Same key" }] } })
  assert.match(html, /Chinese number examples/)
  for (const [number, phrase, meaning] of [
    ["520", "我爱你", "I love you"], ["521", "我爱你", "I love you too (reply)"],
    ["886", "拜拜咯", "bye-bye"], ["1314", "一生一世", "forever"],
    ["5201314", "我爱你一生一世", "I love you forever"],
  ]) {
    assert.ok(html.includes(number) && html.includes(phrase) && html.includes(meaning), number)
  }
  assert.match(html, /<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*>.*521/)
})
