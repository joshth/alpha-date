import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

test("safety response renders support, crisis and outage states", () => {
  const output = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { SafetyResponse } = require("./components/safety/safety-response.tsx");
    globalThis.React = React;
    const base = { action: "safeguarding", categories: ["sexual_exploitation"], crisis: null, decidedBy: "moderation", reason: "moderation_safeguarding" };
    const render = (verdict, message) => renderToStaticMarkup(React.createElement(SafetyResponse, { verdict, message }));
    console.log(JSON.stringify([
      render(base, "Support is available below."),
      render({ ...base, categories: ["suicide_self_harm"], crisis: "self_harm" }, "Support"),
      render({ ...base, action: "refuse", categories: [], decidedBy: "fail_closed", reason: "moderation_unavailable" }, "Please try again."),
    ]));
  `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })
  const [support, crisis, outage] = JSON.parse(output) as string[]
  assert.match(support, /Support is available below/)
  assert.match(support, /role="alert"/)
  assert.match(support, /Support is available/)
  assert.match(crisis, /tel:000/)
  assert.match(crisis, /People you can talk to/)
  assert.match(outage, /Please try again/)
  assert.doesNotMatch(outage, /Support is available|tel:000/)
})
