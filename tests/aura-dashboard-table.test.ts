import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const rendered = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const render = require("react-dom/server").renderToStaticMarkup;
  const Table = require("./components/aura/lifecycle-tab.tsx").AuraDashboardTable;
  const result = { available: typeof Table === "function" };
  if (result.available) {
    result.html = render(React.createElement(Table, { rows: [
      { term: "bussin", stage: "emerging" }, { term: "unknown", stage: null },
    ] }));
    result.empty = render(React.createElement(Table, { rows: [] }));
  }
  console.log(JSON.stringify(result));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } }))

test("Aura page renders an accessible per-term stage table with an empty state", () => {
  assert.equal(rendered.available, true, "Aura lifecycle module should expose the dashboard table")
  const html = rendered.html as string
  assert.match(html, /<caption[^>]*>[^<]*Aura[^<]*<\/caption>/i)
  assert.match(html, /<th[^>]*scope="col"[^>]*>Term<\/th>/)
  assert.match(html, /<th[^>]*scope="col"[^>]*>Aura<\/th>/)
  assert.match(html, /<td[^>]*>bussin<\/td>/)
  assert.match(html, /Emerging/)
  assert.match(html, /No stage yet/)

  assert.match(rendered.empty, /No terms with search data yet/)
  const page = readFileSync("app/lab/aura/page.tsx", "utf8")
  assert.match(page, /getAuraDashboardRows/)
  assert.match(page, /AuraDashboardTable/)
})
