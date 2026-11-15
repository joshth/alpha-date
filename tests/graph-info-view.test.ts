import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { GRAPH_INFO, GRAPH_INFO_IDS } from "../lib/aura/graph-info"

const out = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { GraphInfoView, GraphInfoButton } = require("./components/aura/graph-info.tsx");
  globalThis.React = React;
  const o = {};
  for (const id of ${JSON.stringify(GRAPH_INFO_IDS)}) {
    o[id + ":view"] = r(React.createElement(GraphInfoView, { id }));
    o[id + ":btn"] = r(React.createElement(GraphInfoButton, { id }));
  }
  console.log(JSON.stringify(o));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as Record<string, string>

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;")

for (const id of GRAPH_INFO_IDS) {
  const g = GRAPH_INFO[id]
  test(`${id}: view`, () => {
    const h = out[`${id}:view`]
    assert.ok(h.includes(`<h2`) && h.includes(esc(g.title)))
    assert.match(h, /<h2[^>]*>[^<]*</)
    assert.ok(h.includes(esc(g.shows)))
    const ul = h.match(/<h3[^>]*>How to read it<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/)
    assert.ok(ul, "how to read ul")
    assert.equal((ul![1].match(/<li/g) ?? []).length, g.read.length)
    const v = h.match(/<video[^>]*>/)![0]
    for (const a of ["controls", 'preload="none"', 'playsinline', `poster="/explainers/${id}.jpg"`]) assert.ok(v.toLowerCase().includes(a), a)
    assert.doesNotMatch(v, /autoplay|loop/i)
    assert.ok(h.includes(`<source src="/explainers/${id}.mp4" type="video/mp4"`))
    const t = h.match(/<track[^>]*>/)![0]
    for (const a of ['kind="captions"', `src="/explainers/${id}.vtt"`, 'srcLang="en"', 'label="English"', "default"]) assert.ok(t.toLowerCase().includes(a.toLowerCase()), a)
    assert.match(h, /<details[^>]*>\s*<summary[^>]*>Show transcript<\/summary>/)
    assert.ok(h.split("<details")[1].includes(esc(g.transcript)))
  })
  test(`${id}: button closed`, () => {
    const h = out[`${id}:btn`]
    const b = h.match(/<button[^>]*>/)![0]
    assert.ok(b.includes('type="button"') && b.includes('aria-haspopup="dialog"'))
    assert.ok(b.includes(`aria-label="About this chart: ${esc(g.title)}"`))
    assert.match(b, /\bh-8\b/)
    assert.match(b, /\b(min-)?w-8\b/)
    assert.match(h, /<svg[^>]*aria-hidden="true"/)
    assert.doesNotMatch(h, /<video|How to read it/)
  })
}

test("source: Sheet dialog, Close button, no hex", () => {
  const src = readFileSync("components/aura/graph-info.tsx", "utf8")
  assert.ok(src.startsWith('"use client"'))
  assert.match(src, /from "@\/components\/ui\/sheet"/)
  assert.match(src, /<GraphInfoView/)
  assert.match(src, /Close/)
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/)
})

test("the portalled info sheet resolves its Lab theme tokens", () => {
  const src = readFileSync("components/aura/graph-info.tsx", "utf8")
  assert.match(src, /<SheetContent className="lab [^"]*bg-lab-chrome[^"]*text-lab-text/)
})
