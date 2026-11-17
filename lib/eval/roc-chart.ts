import type { SweepRow } from "@/lib/eval/sweep"

// ROC chart for a sweep (an .svg next to the report, for slides). One line per
// model, at that model's best-AUC temperature, so the chart stays readable.
// x = false-accept rate (FPR), y = recall (TPR); the dashed diagonal is a coin
// flip. Hovering a point shows its threshold, FPR and TPR. Colours are the
// first five categorical slots of the team's validated chart palette, with a
// separate dark-mode step for each.

const LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]
const DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"]

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function bestRowPerModel(rows: readonly SweepRow[]): SweepRow[] {
  const best = new Map<string, SweepRow>()
  for (const row of rows) {
    // Rows with too many errors are left off, as they are left out of the picks.
    if (row.auc === null || !row.reliable) continue
    const held = best.get(row.setting.model)
    if (!held || row.auc > (held.auc ?? -1)) best.set(row.setting.model, row)
  }
  return [...best.values()].slice(0, LIGHT.length)
}

export function rocSvg(rows: readonly SweepRow[], title: string): string | null {
  const lines = bestRowPerModel(rows)
  if (lines.length === 0) return null

  const size = 320
  const left = 64
  const top = 56
  const legendTop = top + size + 56
  const height = legendTop + lines.length * 24 + 16
  const width = left + size + 32
  const x = (fpr: number) => left + fpr * size
  const y = (tpr: number) => top + (1 - tpr) * size

  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const grid = ticks
    .map(
      (t) =>
        `<line class="grid" x1="${x(t)}" y1="${top}" x2="${x(t)}" y2="${top + size}"/>` +
        `<line class="grid" x1="${left}" y1="${y(t)}" x2="${left + size}" y2="${y(t)}"/>` +
        `<text class="tick" x="${x(t)}" y="${top + size + 18}" text-anchor="middle">${t * 100}%</text>` +
        `<text class="tick" x="${left - 8}" y="${y(t) + 4}" text-anchor="end">${t * 100}%</text>`,
    )
    .join("")

  const series = lines
    .map((row, i) => {
      const path = row.roc.map((p, j) => `${j === 0 ? "M" : "L"}${x(p.fpr).toFixed(1)},${y(p.tpr).toFixed(1)}`).join(" ")
      const dots = row.roc
        .filter((p) => p.threshold !== null)
        .map(
          (p) =>
            `<g class="hit"><circle cx="${x(p.fpr).toFixed(1)}" cy="${y(p.tpr).toFixed(1)}" r="12" fill="transparent"/>` +
            `<circle class="s${i}" cx="${x(p.fpr).toFixed(1)}" cy="${y(p.tpr).toFixed(1)}" r="4"/>` +
            `<title>${escape(row.setting.model)} @ ${row.setting.temperature}: accepted in ≥${Math.round(p.threshold! * 100)}% of repeats → ` +
            `false-accept ${(p.fpr * 100).toFixed(0)}%, recall ${(p.tpr * 100).toFixed(0)}%</title></g>`,
        )
        .join("")
      return `<path class="line s${i}" d="${path}"/>${dots}`
    })
    .join("")

  const legend = lines
    .map((row, i) => {
      const ly = legendTop + i * 24
      return (
        `<line class="line s${i}" x1="${left}" y1="${ly}" x2="${left + 24}" y2="${ly}"/>` +
        `<circle class="s${i}" cx="${left + 12}" cy="${ly}" r="4"/>` +
        `<text class="legend" x="${left + 34}" y="${ly + 4}">${escape(row.setting.model)} @ ${row.setting.temperature} · AUC ${row.auc!.toFixed(2)}</text>`
      )
    })
    .join("")

  const colours = (palette: string[]) =>
    palette.map((c, i) => `.line.s${i}{stroke:${c}} circle.s${i}{fill:${c};stroke:var(--surface);stroke-width:2}`).join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t d">
<title id="t">${escape(title)}</title>
<desc id="d">ROC curves: recall against false-accept rate for ${lines.map((r) => `${escape(r.setting.model)} (AUC ${r.auc!.toFixed(2)})`).join(", ")}.</desc>
<style>
svg{--surface:#fcfcfb;--ink:#0b0b0b;--muted:#52514e;--rule:#e4e3df;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--surface)}
${colours(LIGHT)}
@media (prefers-color-scheme: dark){svg{--surface:#1a1a19;--ink:#f0efec;--muted:#c3c2b7;--rule:#3a3936}${colours(DARK)}}
.grid{stroke:var(--rule);stroke-width:1}
.axis{stroke:var(--muted);stroke-width:1}
.chance{stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 4}
.line{fill:none;stroke-width:2;stroke-linejoin:round}
.tick{fill:var(--muted);font-size:11px}
.label{fill:var(--muted);font-size:12px}
.legend{fill:var(--ink);font-size:13px}
.head{fill:var(--ink);font-size:15px;font-weight:600}
.hit:hover circle:last-of-type{r:6}
</style>
<text class="head" x="${left}" y="24">${escape(title)}</text>
<text class="label" x="${left}" y="42">Higher and further left is better. Dashed line = coin flip.</text>
${grid}
<line class="axis" x1="${left}" y1="${top + size}" x2="${left + size}" y2="${top + size}"/>
<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + size}"/>
<line class="chance" x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}"/>
<text class="label" x="${left + size / 2}" y="${top + size + 38}" text-anchor="middle">False-accept rate (made-up and ordinary words accepted)</text>
<text class="label" transform="translate(16 ${top + size / 2}) rotate(-90)" text-anchor="middle">Recall (real slang found)</text>
${series}
${legend}
</svg>
`
}
