import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { inlineCssVars, prepareSvgForExport, pngFilename, cssVarNames } from "../lib/export/png"

const vars = { "--lab-text": "240 9% 93%", "--c": "#123456" }
const size = { width: 400, height: 300 }

test("inlineCssVars replaces var(), fallback form, and hsl(var()) in styles", () => {
  assert.equal(inlineCssVars('<text fill="hsl(var(--lab-text))"/>', vars), '<text fill="hsl(240 9% 93%)"/>')
  assert.equal(inlineCssVars('<g style="stroke:var(--c, red);fill:var(--c)"/>', vars), '<g style="stroke:#123456;fill:#123456"/>')
})

test("inlineCssVars leaves unknown vars untouched", () => {
  assert.equal(inlineCssVars('<g fill="var(--nope)"/>', vars), '<g fill="var(--nope)"/>')
})

test("cssVarNames returns unique names used", () => {
  const m = '<a fill="var(--x)"/><b style="c:hsl(var(--y)) var(--x, 1px)"/>'
  assert.deepEqual([...cssVarNames(m)].sort(), ["--x", "--y"])
  assert.deepEqual(cssVarNames("<svg/>"), [])
})

test("prepareSvgForExport adds namespaces, size, viewBox and background rect first", () => {
  const out = prepareSvgForExport("<svg><circle r='1'/></svg>", size, "#0b0b10")
  assert.match(out, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(out, /xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)
  assert.match(out, /width="400"/)
  assert.match(out, /height="300"/)
  assert.match(out, /viewBox="0 0 400 300"/)
  assert.match(out, /<svg[^>]*>\s*<rect width="100%" height="100%" fill="#0b0b10"\/>\s*<circle/)
})

test("prepareSvgForExport keeps an existing viewBox and namespaces", () => {
  const src = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><g/></svg>'
  const out = prepareSvgForExport(src, size, "#fff")
  assert.equal((out.match(/viewBox=/g) ?? []).length, 1)
  assert.match(out, /viewBox="0 0 10 10"/)
  assert.equal((out.match(/xmlns=/g) ?? []).length, 1)
  assert.equal((out.match(/xmlns:xlink=/g) ?? []).length, 1)
})

test("prepareSvgForExport strips foreignObject, script and on* handlers", () => {
  const src = '<svg viewBox="0 0 1 1"><foreignObject><div>hi</div></foreignObject><script>alert(1)</script><g onclick="x()" onload=\'y()\'/></svg>'
  const out = prepareSvgForExport(src, size, "#fff")
  assert.doesNotMatch(out, /foreignObject|<script|alert|onclick|onload|hi<\/div>/i)
  assert.match(out, /<g[^>]*\/>/)
})

test("pngFilename", () => {
  assert.equal(pngFilename("Similarity Graph", new Date(2026, 10, 4, 12)), "similarity-graph-2026-11-04.png")
  assert.equal(pngFilename("", new Date(2026, 10, 4, 12)), "export-2026-11-04.png")
})

// An image cannot use the page's web fonts, so without a family the text falls back to a serif face.
test("prepareSvgForExport gives the image a sans-serif font family, and keeps one that is already set", () => {
  const out = prepareSvgForExport('<svg viewBox="0 0 10 10"><text>2026-01</text></svg>', { width: 10, height: 10 }, "white")
  assert.match(out, /<svg[^>]*\sfont-family="[^"]*sans-serif"/)
  const kept = prepareSvgForExport('<svg font-family="Courier" viewBox="0 0 10 10"></svg>', { width: 10, height: 10 }, "white")
  assert.equal((kept.match(/font-family=/g) ?? []).length, 1)
  assert.match(kept, /font-family="Courier"/)
})
