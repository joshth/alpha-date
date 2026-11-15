import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const html: Record<string, string> = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { TrendPlayer } = require("./components/aura/trend-player.tsx");
  globalThis.React = React;
  globalThis.AudioContext = class { constructor() { throw new Error("sound started without a press") } };
  const series = [0.1, 0.5, 1, 0.4];
  console.log(JSON.stringify({
    staged: r(React.createElement(TrendPlayer, { stage: "declining", series })),
    none: r(React.createElement(TrendPlayer, { stage: null, series })),
  }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))
const src = readFileSync("components/aura/trend-player.tsx", "utf8")

test("TrendPlayer: no stage, no player", () => {
  assert.equal(html.none, "")
})

test("TrendPlayer: a Play trend button that is not yet playing", () => {
  assert.match(html.staged, /<button[^>]*type="button"[^>]*>Play trend<\/button>/)
  assert.doesNotMatch(html.staged, />Stop</)
})

test("TrendPlayer: a labelled volume slider from 0 to 1", () => {
  const input = html.staged.match(/<input[^>]*type="range"[^>]*>/)?.[0] ?? ""
  assert.match(input, /min="0"/)
  assert.match(input, /max="1"/)
  const id = input.match(/id="([^"]+)"/)?.[1]
  assert.ok(id, "the slider needs an id")
  assert.match(html.staged, new RegExp(`<label[^>]*for="${id}"[^>]*>Volume</label>`))
})

test("TrendPlayer: sound starts from the button only and the button can stop it", () => {
  assert.equal(src.match(/new AudioContext\(/g)?.length, 1)
  assert.equal(src.match(/playTrend\(/g)?.length, 1)
  assert.doesNotMatch(src, /autoPlay|<audio/)
  for (const effect of src.split("useEffect(").slice(1)) assert.match(effect, /^\(\) => \(\) =>/, "an effect may only clean up")
  assert.match(src, /"Stop"/)
  assert.match(src, /"use client"/)
})

test("TrendPlayer: controls meet the 24px target size and use lab tokens", () => {
  assert.match(html.staged, /<button[^>]*class="[^"]*\bh-(8|9|10)\b/)
  assert.doesNotMatch(html.staged, /#[0-9a-fA-F]{3,8}\b/)
})
