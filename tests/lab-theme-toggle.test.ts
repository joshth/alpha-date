import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const render = (pref: string): string => JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { ThemeToggle } = require("./components/lab/theme-toggle.tsx");
  globalThis.React = React;
  console.log(JSON.stringify(renderToStaticMarkup(React.createElement(ThemeToggle, { pref: ${JSON.stringify(pref)} }))));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))

const buttons = (html: string) => html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? []
const text = (b: string) => b.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").trim()

test("ThemeToggle is a labelled group of three buttons: Light, Dark, System", () => {
  const html = render("dark")
  assert.match(html, /^<div[^>]*role="group"[^>]*aria-label="Colour theme"/)
  const bs = buttons(html)
  assert.deepEqual(bs.map(text), ["Light", "Dark", "System"])
  for (const b of bs) {
    assert.match(b, /^<button[^>]*type="button"/)
    assert.match(b, /<svg[^>]*aria-hidden="true"/)
  }
})

test("only the button matching pref is aria-pressed=true", () => {
  for (const [pref, i] of [["light", 0], ["dark", 1], ["system", 2]] as const) {
    const pressed = buttons(render(pref)).map((b) => /aria-pressed="true"/.test(b))
    assert.deepEqual(pressed, [0, 1, 2].map((j) => j === i), pref)
  }
})

test("buttons meet the 24px target size and the markup has no raw hex colours", () => {
  const html = render("system")
  for (const b of buttons(html)) {
    const cls = b.match(/class="([^"]*)"/)?.[1] ?? ""
    assert.match(cls, /(^|\s)h-8(\s|$)/)
    assert.match(cls, /(^|\s)(min-w-8|w-8)(\s|$)/)
  }
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/)
})

test("shell.tsx renders ThemeToggle inside the header and takes themePref / onThemeChange", () => {
  const src = readFileSync("components/lab/shell.tsx", "utf8")
  const header = src.match(/<header[\s\S]*<\/header>/)?.[0] ?? ""
  assert.ok(header.includes("<ThemeToggle"), "ThemeToggle not in <header>")
  assert.ok(header.indexOf("<ThemeToggle") < header.indexOf("{initials}"), "toggle should sit before the avatar")
  assert.ok(src.includes("themePref") && src.includes("onThemeChange"))
})
