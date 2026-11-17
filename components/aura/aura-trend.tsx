import { TrendPlayer } from "@/components/aura/trend-player"
import { GraphInfoButton } from "@/components/aura/graph-info"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SirsFit } from "@/lib/aura/fit-command"
import { lifecycleRows, trendSentence } from "@/lib/aura/trend-text"

const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 3 })

export function AuraTrend({ fit }: { fit: SirsFit }) {
  const rows = lifecycleRows(fit)
  return (
    <section aria-labelledby="aura-trend-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="aura-trend-heading" className="text-sm font-medium">Search interest and fitted curve</h2>
        <GraphInfoButton id="interest" />
      </div>
      <p className="text-sm">{trendSentence(fit)}</p>
      <TrendPlayer stage={fit.stage} series={rows.map((r) => r.fitted)} />
      <details>
        <summary className="cursor-pointer text-sm text-lab-muted focus-visible:outline focus-visible:outline-2">Trend table</summary>
        <div className="mt-2 max-h-80 overflow-auto">
          <Table>
            <TableCaption>Weekly fitted interest for {fit.term} over the 180-day window</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Week</TableHead>
                <TableHead scope="col">Fitted interest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.filter((r) => r.inWindow).map((r) => (
                <TableRow key={r.week}>
                  <TableCell>{r.week}</TableCell>
                  <TableCell className="font-mono tabular-nums text-right">{fmt.format(r.fitted)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </section>
  )
}
