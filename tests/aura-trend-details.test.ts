import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { trendSentence } from "../lib/aura/trend-text"

const N = 30
const weeks = Array.from({ length: N }, (_, i) => new Date(Date.UTC(2026, 3, 6 + 7 * i)).toISOString().slice(0, 10))
const I = weeks.map((_, i) => (i + 1) / 100)
const fit = {
  term: "rizz", generation: "alpha", modelVersion: "m", now: weeks[N - 1], weeks, counts: weeks.map((_, i) => i),
  fitted: { I, S: weeks.map(() => 0.7), R: weeks.map(() => 0.1), Gamma: weeks.map(() => 0) },
  r: 0.65, delta: -0.2, stage: "declining", confidence: 0.9, peakWeek: weeks[10], windowStart: weeks[4],
}
const html: Record<string, string> = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { AuraTrend } = require("./components/aura/aura-trend.tsx");
  globalThis.React = React;
  const fit = ${JSON.stringify(fit)};
  console.log(JSON.stringify({
    staged: r(React.createElement(AuraTrend, { fit })),
    none: r(React.createElement(AuraTrend, { fit: { ...fit, stage: null } })),
  }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))
const esc = (s: string) => s.replace(/'/g, "&#x27;")

test("AuraTrend: the sentence is always visible, above the closed details", () => {
  const h = html.staged
  const sentence = trendSentence(fit as never)
  assert.equal(sentence, "Down 35% from its peak, down 20 points in the last 180 days.")
  assert.ok(h.indexOf(sentence) >= 0 && h.indexOf(sentence) < h.indexOf("<details"))
  assert.doesNotMatch(h, /<details[^>]*\bopen\b/)
  assert.match(h, /<summary[^>]*>Trend table and sound<\/summary>/)
})

test("AuraTrend: a captioned table with header cells lists the weekly fitted points in the 180-day window", () => {
  const h = html.staged
  assert.match(h, /<caption[^>]*>[^<]*rizz[^<]*<\/caption>/)
  assert.match(h, /<th[^>]*scope="col"[^>]*>Week<\/th>/)
  assert.match(h, /<th[^>]*scope="col"[^>]*>Fitted interest<\/th>/)
  const body = h.split("<tbody")[1].split("</tbody>")[0]
  assert.equal(body.match(/<tr/g)?.length, N - 4)
  assert.ok(body.includes(`>${weeks[4]}<`) && body.includes(`>${weeks[N - 1]}<`))
  assert.ok(!body.includes(`>${weeks[3]}<`))
  assert.match(body, /<td[^>]*font-mono[^>]*>0\.3<\/td>/)
})

test("AuraTrend: Play trend sits inside the details when there is a stage", () => {
  const h = html.staged
  assert.ok(h.indexOf("Play trend") > h.indexOf("<details") && h.indexOf("Play trend") < h.indexOf("</details>"))
})

test("AuraTrend: no stage keeps the honest sentence and hides Play trend", () => {
  assert.ok(html.none.includes(esc(trendSentence({ r: 0.65, delta: -0.2, stage: null }))))
  assert.doesNotMatch(html.none, /Play trend/)
})
