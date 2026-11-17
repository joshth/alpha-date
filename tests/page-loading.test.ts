import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const kinds = ["dashboard", "aura", "dedup", "eval", "review", "search", "activity", "incidents"]
const rendered: Record<string, string> = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const render = require("react-dom/server").renderToStaticMarkup;
  const { LabPageLoading } = require("./components/lab/page-loading.tsx");
  globalThis.React = React;
  const kinds = ${JSON.stringify(kinds)};
  const output = {};
  for (const kind of kinds) output[kind] = render(React.createElement(LabPageLoading, { kind }));
  console.log(JSON.stringify(output));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))

test("each app route has an accessible skeleton loading boundary", () => {
  const routes: [string, string][] = [
    ["app/loading.tsx", "dashboard"], ["app/lab/loading.tsx", "dashboard"], ["app/lab/aura/loading.tsx", "aura"],
    ["app/lab/dedup/loading.tsx", "dedup"], ["app/lab/eval/loading.tsx", "eval"],
    ["app/lab/review/loading.tsx", "review"], ["app/lab/search/loading.tsx", "search"],
    ["app/lab/safety-activity/loading.tsx", "activity"], ["app/lab/safety-incidents/loading.tsx", "incidents"],
  ]
  for (const [file, kind] of routes) {
    assert.ok(existsSync(file), `${file} exists`)
    assert.match(readFileSync(file, "utf8"), new RegExp(`kind="${kind}"`), file)
    const html = rendered[kind]
    assert.match(html, /role="status"/)
    assert.match(html, /aria-label="Loading [^"]+"/)
    assert.match(html, /animate-pulse/)
    assert.match(html, /aria-hidden="true"/)
  }
})

test("long-running client actions show skeleton feedback", () => {
  const search = readFileSync("components/search/search-panel.tsx", "utf8")
  assert.match(search, /aria-label="Loading search result"/)
  assert.match(search, /aria-label="Sending suggestion"/)
  const aura = readFileSync("components/aura/lifecycle-tab.tsx", "utf8")
  assert.match(aura, /function AuraFitLoading\(/)
  const evalPanel = readFileSync("components/lab/eval-panel.tsx", "utf8")
  assert.match(evalPanel, /aria-label="Running evaluation"/)
  assert.match(evalPanel, /aria-label="Checking evaluation file"/)
  const review = readFileSync("components/review/review-buttons.tsx", "utf8")
  assert.match(review, /aria-label="Saving review decision"/)
})
