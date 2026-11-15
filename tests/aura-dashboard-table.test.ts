import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const rendered = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const render = require("react-dom/server").renderToStaticMarkup;
  const module = require("./components/aura/lifecycle-tab.tsx");
  const { AuraDashboardTable: Table, LifecycleTab, sortAuraDashboardRows } = module;
  const rows = [
    { term: "unknown", stage: null }, { term: "clout", stage: "peaking" }, { term: "bussin", stage: "emerging" },
  ];
  const result = { available: typeof Table === "function" };
  if (result.available) {
    result.html = render(React.createElement(Table, { rows }));
    result.empty = render(React.createElement(Table, { rows: [] }));
    result.tab = render(React.createElement(LifecycleTab, { fitAction: async () => ({}), dashboardRows: rows }));
    if (typeof sortAuraDashboardRows === "function") {
      result.termAscending = sortAuraDashboardRows(rows, "term", "ascending").map((row) => row.term);
      result.termDescending = sortAuraDashboardRows(rows, "term", "descending").map((row) => row.term);
      result.auraAscending = sortAuraDashboardRows(rows, "aura", "ascending").map((row) => row.term);
    }
  }
  console.log(JSON.stringify(result));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))

test("Aura page renders an accessible per-term stage table with an empty state", () => {
  assert.equal(rendered.available, true, "Aura lifecycle module should expose the dashboard table")
  const html = rendered.html as string
  assert.match(html, /<caption[^>]*>[^<]*Aura[^<]*<\/caption>/i)
  assert.match(html, /<th[^>]*aria-sort="ascending"[^>]*>[\s\S]*?<button[^>]*type="button"[^>]*>Term/)
  assert.match(html, /<th[^>]*>[\s\S]*?<button[^>]*type="button"[^>]*>Aura/)
  assert.ok(html.indexOf("bussin") < html.indexOf("clout") && html.indexOf("clout") < html.indexOf("unknown"), "term ascending is the default")
  assert.match(html, /Emerging/)
  assert.match(html, /Peaking/)
  assert.match(html, /No stage yet/)
  assert.deepEqual(rendered.termAscending, ["bussin", "clout", "unknown"])
  assert.deepEqual(rendered.termDescending, ["unknown", "clout", "bussin"])
  assert.deepEqual(rendered.auraAscending, ["bussin", "unknown", "clout"])

  assert.match(rendered.empty, /No terms with search data yet/)
  const page = readFileSync("app/lab/aura/page.tsx", "utf8")
  assert.match(page, /getAuraDashboardRows/)
  assert.match(page, /<LifecycleTab[^>]*dashboardRows=\{rows\}/)
  assert.ok(rendered.tab.indexOf("</form>") < rendered.tab.indexOf('aria-labelledby="aura-dashboard-heading"'), "the dashboard table follows the search form")
})
