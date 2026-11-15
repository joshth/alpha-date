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

const icon = (html: string) => html.match(/<span[^>]*aria-hidden="true"[^>]*>([^<]*)<\/span>/)!
const visible = (html: string) => html.replace(/<span[^>]*sr-only[^>]*>.*?<\/span>/g, "").replace(/<[^>]+>/g, "")

const spec: [string, string, string, string][] = [
  ["emerging", "↗", "text-stage-emerging", AURA_STAGE_LABELS.emerging],
  ["peaking", "▲", "text-stage-peaking", AURA_STAGE_LABELS.peaking],
  ["declining", "↘", "text-stage-declining", AURA_STAGE_LABELS.declining],
  ["parent_territory", "●", "text-stage-parent", AURA_STAGE_LABELS.parent_territory],
  ["null", "○", "text-lab-muted", "No stage yet"],
]
for (const [k, shape, colour, label] of spec) {
  test(`AuraBadge ${k}: aria-hidden shape, colour class, visible label`, () => {
    const html = run()[k]
    const m = icon(html)
    assert.equal(m[1], shape)
    assert.match(m[0], new RegExp(`class="[^"]*${colour}`))
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

test("AuraBadge has no raw hex", () => {
  for (const html of Object.values(run()) as string[]) assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/)
})
