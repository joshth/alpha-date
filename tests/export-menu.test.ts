import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"

let cached: Record<string, string> | undefined
const run = () => (cached ??= JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { ExportMenuView } = require("./components/aura/export-menu.tsx");
  globalThis.React = React;
  const noop = () => {};
  const mk = (open, showPng) => renderToStaticMarkup(React.createElement(ExportMenuView,
    { open, onToggle: noop, onCsv: noop, onXlsx: noop, onPng: noop, showPng, id: "exp-menu" }));
  console.log(JSON.stringify({ closed: mk(false, true), open: mk(true, true), noPng: mk(true, false) }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })))

test("closed: Export button with aria wiring, icon, no menu items", () => {
  const html = run().closed
  assert.match(html, /<button[^>]*type="button"[^>]*>/)
  assert.match(html, /aria-haspopup="true"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-controls="exp-menu"/)
  assert.match(html, /<button[^>]*>[^]*<svg[^>]*aria-hidden="true"[^]*Export/)
  assert.doesNotMatch(html, /CSV|Excel|Image \(|role="group"/)
})

test("open: group with CSV, Excel and PNG buttons", () => {
  const html = run().open
  assert.match(html, /aria-expanded="true"/)
  assert.match(html, /<div[^>]*id="exp-menu"[^>]*role="group"[^>]*aria-label="Export format"|<div[^>]*role="group"[^>]*id="exp-menu"[^>]*aria-label="Export format"|<div[^>]*aria-label="Export format"[^>]*id="exp-menu"[^>]*role="group"/)
  for (const t of ["CSV (.csv)", "Excel (.xlsx)", "Image (.png)"])
    assert.match(html, new RegExp(`<button[^>]*type="button"[^>]*>[^<]*(<[^>]+>[^<]*)*${t.replace(/[().]/g, "\\$&")}`))
  assert.doesNotMatch(html, /role="menuitem"/)
})

test("open without showPng omits the image item", () => {
  const html = run().noPng
  assert.ok(html.includes("CSV (.csv)") && html.includes("Excel (.xlsx)"))
  assert.ok(!html.includes("Image (.png)"))
})

test("items are at least 24px tall and use no raw hex", () => {
  const html = run().open
  const items = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>[^]*?(?:CSV|Excel|Image) \(/g)].map((m) => m[1])
  assert.equal(items.length, 3)
  for (const c of items) assert.match(c, /\bh-(8|9|10|11|12)\b/)
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/)
})

test("source handles Escape with focus return and outside pointerdown", () => {
  const src = readFileSync("components/aura/export-menu.tsx", "utf8")
  assert.match(src, /Escape/)
  assert.match(src, /\.focus\(\)/)
  assert.match(src, /["'](pointerdown|mousedown)["']/)
  assert.match(src, /^["']use client["']/)
})
