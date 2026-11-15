import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

type S = { key: string; label: string; color: string; dash: string; shape: string }
// render in a child process: importing lifecycle-charts here breaks under react-server
const out = JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  globalThis.React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const m = require("./components/aura/lifecycle-charts.tsx");
  const r = (s) => renderToStaticMarkup(React.createElement(m.SeriesLegend, { series: s }));
  console.log(JSON.stringify({ MAIN: [m.MAIN_SERIES, r(m.MAIN_SERIES)], SHARE: [m.SHARE_SERIES, r(m.SHARE_SERIES)] }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })) as Record<string, [S[], string]>

for (const [name, [series, html]] of Object.entries(out)) {
  test(`${name} legend: labelled list, swatch per series, line style differs`, () => {
    assert.match(html, /<ul[^>]*aria-label="Legend"/)
    const items = html.split(/<li[ >]/).slice(1)
    assert.equal(items.length, series.length)
    const dashes: string[] = []
    series.forEach((s, i) => {
      const li = items[i]
      assert.ok(li.includes(s.label), `${s.label} visible`)
      assert.match(li, /<svg[^>]*aria-hidden="true"[^>]*>|<svg[^>]*width="24"[^>]*aria-hidden="true"/)
      assert.match(li, /<svg[^>]*width="24"/)
      if (s.shape === "line") {
        const line = li.match(/<line[^>]*>/)?.[0] ?? ""
        assert.ok(line.includes(`stroke-dasharray="${s.dash}"`), `${s.key} dash`)
        assert.ok(line.includes(`stroke="${s.color}"`), `${s.key} stroke`)
        dashes.push(s.dash)
      } else {
        assert.ok((li.match(/<circle[^>]*>/)?.[0] ?? "").includes(`fill="${s.color}"`), `${s.key} fill`)
        dashes.push("dot")
      }
    })
    assert.equal(new Set(dashes).size, series.length)
  })
}
