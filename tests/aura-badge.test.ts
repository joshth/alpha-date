import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { AURA_STAGE_LABELS, LOW_CONFIDENCE, type AuraStage } from "../lib/aura"

const cases: [string, AuraStage | null, number][] = [
  ["emerging", "emerging", 0.9], ["peaking", "peaking", 0.9], ["declining", "declining", 0.9],
  ["parent_territory", "parent_territory", 0.9], ["low", "peaking", 0.3], ["medium", "emerging", 0.5], ["null", null, 0.9],
]
let cached: Record<string, string> | undefined
const run = () => (cached ??= JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { AuraBadge } = require("./components/aura/aura-badge.tsx");
  globalThis.React = React;
  const out = {};
  for (const [k, stage, confidence] of ${JSON.stringify(cases)})
    out[k] = renderToStaticMarkup(React.createElement(AuraBadge, { stage, confidence }));
  console.log(JSON.stringify(out));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })))

const visible = (html: string) => html.replace(/<span[^>]*sr-only[^>]*>.*?<\/span>/g, "").replace(/<[^>]+>/g, "")

const spec: [string, string, string][] = [
  ["emerging", "text-stage-emerging", AURA_STAGE_LABELS.emerging],
  ["peaking", "text-stage-peaking", AURA_STAGE_LABELS.peaking],
  ["declining", "text-stage-declining", AURA_STAGE_LABELS.declining],
  ["parent_territory", "text-stage-parent", AURA_STAGE_LABELS.parent_territory],
  ["null", "text-lab-muted", "No stage yet"],
]
for (const [k, colour, label] of spec) {
  test(`AuraBadge ${k}: one aria-hidden SVG icon, colour class, visible label`, () => {
    const html = run()[k]
    assert.match(html, new RegExp(`<svg[^>]*aria-hidden="true"[^>]*class="[^"]*${colour}`))
    assert.doesNotMatch(html, /<span[^>]*aria-hidden="true"/, "no second text glyph beside the SVG")
    assert.ok(visible(html).includes(label))
  })
}

test("AuraBadge confidence wording", () => {
  const r = run()
  assert.match(r.emerging, /sr-only[^>]*>[^<]*high confidence/)
  assert.ok(LOW_CONFIDENCE > 0.3 && LOW_CONFIDENCE < 0.7)
  assert.doesNotMatch(r.emerging, /border-dashed|\(low confidence\)/)
  assert.match(r.medium, /sr-only[^>]*>[^<]*medium confidence/)
  assert.doesNotMatch(r.medium, /border-dashed|\(low confidence\)/)
  assert.ok(visible(r.low).includes("(low confidence)"))
  assert.match(r.low, /border-dashed/)
})

test("AuraBadge exposes a complete accessible name and distinct SVG icons", () => {
  const r = run()
  assert.match(r.emerging, /aria-label="Aura: Emerging, high confidence"/)
  assert.match(r.low, /aria-label="Aura: Peaking, low confidence"/)
  assert.match(r.null, /aria-label="Aura: No stage yet, high confidence"/)
  for (const k of ["emerging", "peaking", "declining", "parent_territory", "null"]) {
    assert.match(r[k], /<svg[^>]*aria-hidden="true"/)
  }
  const icons = ["emerging", "peaking", "declining", "parent_territory", "null"]
    .map((k) => r[k].match(/data-aura-icon="([^"]+)"/)?.[1])
  assert.equal(new Set(icons).size, 5)
})

test("AuraGlossary lists every Aura state and its meaning", () => {
  const html = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { AuraGlossary } = require("./components/aura/aura-badge.tsx");
    console.log(renderToStaticMarkup(React.createElement(AuraGlossary, { open: true })));
  `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })
  assert.match(html, /What does this mean\?/)
  for (const label of ["Emerging", "Peaking", "Declining", "Parent territory", "No stage yet"]) {
    assert.ok(html.includes(label), `${label} appears in the glossary`)
  }
  assert.match(html, /role="dialog"/)
  assert.match(html, /aria-modal="true"/)
})

test("AuraBadge has no raw hex", () => {
  for (const html of Object.values(run()) as string[]) assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/)
})

test("AuraGlossary trigger reports whether the glossary is open", () => {
  const render = (open: boolean) => execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { AuraGlossary } = require("./components/aura/aura-badge.tsx");
    console.log(renderToStaticMarkup(React.createElement(AuraGlossary, { open: ${open} })));
  `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })
  assert.match(render(false), /<button[^>]*aria-expanded="false"/)
  assert.match(render(true), /<button[^>]*aria-expanded="true"/)
})
