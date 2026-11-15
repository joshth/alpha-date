import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { trendSentence } from "../lib/aura/trend-text"

const weeks = ["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]
const fit = {
  term: "rizz", generation: "alpha", modelVersion: "m", now: "2026-11-09", weeks, counts: [1, 2, 3, 4],
  fitted: { I: [1, 2, 3, 4], S: [1, 1, 1, 1], R: [0, 0, 0, 0], Gamma: [0, 0, 0, 0] },
  r: 0.8765, delta: -0.1234, stage: "declining", confidence: 0.876, peakWeek: "2026-11-02", windowStart: "2026-10-19",
}
const outcomes: Record<string, unknown> = {
  vendored: { kind: "fit", fit, source: "vendored", stageNote: null },
  synthetic: { kind: "fit", fit, source: "synthetic", stageNote: null },
  nullStage: { kind: "fit", fit: { ...fit, stage: null }, source: "vendored", stageNote: "No stage yet: the curve hasn't taken off" },
  noData: { kind: "no_data", term: "skibidi", suggestions: ["skibidi toilet", "skibid", "sigma", "extra"] },
  blocked: { kind: "blocked", message: "That term is blocked." },
  invalid: { kind: "invalid", message: "Enter a term between 2 and 100 characters." },
}
const html: Record<string, string> = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup: r } = require("react-dom/server");
  const { LifecycleResult, LifecycleTab } = require("./components/aura/lifecycle-tab.tsx");
  globalThis.React = React;
  const out = {};
  for (const [k, outcome] of Object.entries(${JSON.stringify(outcomes)})) out[k] = r(React.createElement(LifecycleResult, { outcome }));
  out.tab = r(React.createElement(LifecycleTab, { fitAction: async () => ({}) }));
  out.initialTab = r(React.createElement(LifecycleTab, { initialTerm: "rizz & roll", fitAction: async () => ({}) }));
  console.log(JSON.stringify(out));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))
const esc = (s: string) => s.replace(/'/g, "&#x27;")

test("fit: stat row dt/dd pairs with formatted mono numbers", () => {
  const h = html.vendored
  assert.match(h, /<dl/)
  for (const t of ["Stage", "r", "Δ", "Peak week", "Confidence"]) assert.match(h, new RegExp(`<dt[^>]*>${t}</dt>`))
  assert.match(h, /<dd[^>]*>[\s\S]*?sr-only[^>]*>Declining/i)
  for (const v of ["0.88", "-0.12", "88%", "2026-11-02"]) assert.match(h, new RegExp(`<dd[^>]*font-mono[^>]*tabular-nums[^>]*>${v}</dd>|<dd[^>]*tabular-nums[^>]*font-mono[^>]*>${v}</dd>`))
})

test("fit: explanation, source note and stage note", () => {
  assert.ok(html.vendored.includes(esc(trendSentence(fit as never))))
  assert.ok(html.vendored.includes("Google Trends"))
  assert.ok(html.synthetic.includes("this site&#x27;s search events"))
  assert.doesNotMatch(html.vendored, /this site&#x27;s search events/)
  assert.ok(html.nullStage.includes(esc("No stage yet: the curve hasn't taken off")))
})

test("no_data: heading, term, up to 3 suggestion buttons, no chart", () => {
  const h = html.noData
  assert.ok(h.includes("No search data for this term") && h.includes("skibidi"))
  const buttons = h.match(/<button type="button"[^>]*data-suggestion[^>]*>[^<]*<\/button>/g) ?? []
  assert.equal(buttons.length, 3)
  assert.ok(buttons[0].includes("skibidi toilet"))
  assert.doesNotMatch(h, /<svg/)
})

test("blocked and invalid: role=alert with the message", () => {
  assert.match(html.blocked, /role="alert"[^>]*>[^<]*That term is blocked\./)
  assert.match(html.invalid, /role="alert"[^>]*>[^<]*Enter a term between 2 and 100 characters\./)
})

test("LifecycleTab: labelled form, Fit button, empty polite live region", () => {
  const h = html.tab
  const id = h.match(/<label[^>]*for="([^"]+)"[^>]*>\s*Term\s*<\/label>/)?.[1]
  assert.ok(id && /<input[^>]*name="term"/.test(h) && new RegExp(`<input[^>]*id="${id}"`).test(h))
  assert.match(h, /<form/)
  assert.match(h, /<button[^>]*type="submit"[^>]*>\s*Fit\s*<\/button>/)
  assert.match(h, /<div[^>]*(role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status")[^>]*><\/div>/)
})

test("LifecycleTab: initial term is prefilled and fitted on mount", () => {
  assert.match(html.initialTab, /<input[^>]*value="rizz &amp; roll"/)
  assert.match(readFileSync("components/aura/lifecycle-tab.tsx", "utf8"), /useEffect\([\s\S]*initialTerm[\s\S]*fitAction/)
})

test("LifecycleTab keeps a search form that opens the term route", () => {
  const source = readFileSync("components/aura/lifecycle-tab.tsx", "utf8")
  assert.match(source, /auraTermPath\(value\)/)
  assert.match(source, /window\.location\.assign/)
  assert.match(html.tab, /role="search"/)
})

test("pending text lives in the module", () => {
  assert.ok(readFileSync("components/aura/lifecycle-tab.tsx", "utf8").includes("Fitting the SIRS model…"))
})

test("fit: the trend expands to a weekly table and Play trend; no stage has no Play trend", () => {
  const h = html.vendored
  assert.match(h, /<summary[^>]*>Trend table and sound<\/summary>/)
  assert.match(h, /<caption[^>]*>[^<]*rizz[^<]*<\/caption>/)
  assert.match(h, /<button[^>]*>Play trend<\/button>/)
  assert.equal(h.split(esc(trendSentence(fit as never))).length, 2, "the sentence is shown once")
  assert.match(html.nullStage, /<summary[^>]*>Trend table and sound<\/summary>/)
  assert.doesNotMatch(html.nullStage, /Play trend/)
})
