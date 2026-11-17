import "./setup"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

const render = (): string => execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react"); globalThis.React = React;
  const { renderToStaticMarkup } = require("react-dom/server");
  const { RegionSelector } = require("./components/safety/region-selector.tsx");
  console.log(renderToStaticMarkup(React.createElement(RegionSelector)));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })

test("the support location trigger shows only the flag, with an accessible name", () => {
  const html = render()
  const trigger = html.match(/<button[^>]*role="combobox"[\s\S]*?<\/button>/)?.[0] ?? ""
  assert.match(trigger, /aria-label="Support location"/)
  assert.match(trigger, /<img[^>]*src="[^"]*\/flags\//)
  assert.doesNotMatch(trigger.replace(/<[^>]+>/g, ""), /\S/, "trigger should have no visible text")
  assert.doesNotMatch(html, /<label[^>]*>Support location<\/label>/)
})
