import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

let cached: { on: string; off: string; active: string; none: string } | undefined
const run = () => (cached ??= JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { FocusDot } = require("./components/aura/lifecycle-charts.tsx");
  globalThis.React = React;
  const payload = { week: "2026-10-25", interest: 0.42, fitted: 0.4 };
  const r = (p) => renderToStaticMarkup(React.createElement("svg", null, React.createElement(FocusDot, p)));
  console.log(JSON.stringify({
    on: r({ cx: 10, cy: 20, index: 3, payload, tabbable: true }),
    off: r({ cx: 10, cy: 20, index: 4, payload, tabbable: false }),
    active: r({ cx: 10, cy: 20, index: 3, payload, tabbable: true, active: true }),
    none: renderToStaticMarkup(React.createElement(FocusDot, { payload })),
  }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })))

test("FocusDot (roving tabindex) is a focusable labelled circle with a real target size", () => {
  const html = run().on
  const c = html.match(/<circle[^>]*>/)![0]
  assert.match(c, /tabindex="0"/)
  assert.match(run().off.match(/<circle[^>]*>/)![0], /tabindex="-1"/)
  assert.match(c, /role="img"/)
  assert.match(c, /aria-label="Week 2026-10-25: interest 0\.42, fitted 0\.40"/)
  assert.ok(Number(c.match(/\br="([\d.]+)"/)![1]) >= 4)
})

test("FocusDot has focus or active styling", () => {
  const { on, active } = run()
  assert.ok(/focus-visible:/.test(on) || on !== active)
})

test("FocusDot renders nothing without cx/cy", () => {
  assert.equal(run().none, "")
})
