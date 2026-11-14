"use client"
import { useId, useState, type ReactNode } from "react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Col = { key: string; label: string; numeric?: boolean }
const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 3 })

export function ChartPanel({ title, summary, table, defaultShowTable = false, children }: {
  title: string; summary: string; defaultShowTable?: boolean; children: ReactNode
  table: { caption: string; columns: Col[]; rows: Record<string, string | number | boolean>[] }
}) {
  const [showTable, setShowTable] = useState(defaultShowTable)
  const summaryId = useId()
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <button type="button" aria-pressed={showTable} onClick={() => setShowTable(!showTable)}
          className="rounded-md border border-lab-border px-2 py-1 text-xs hover:bg-lab-raised focus-visible:outline focus-visible:outline-2">
          {showTable ? "Show as chart" : "Show as table"}
        </button>
      </div>
      <p id={summaryId} className="text-sm text-lab-muted">{summary}</p>
      {showTable ? (
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableCaption className="sr-only">{table.caption}</TableCaption>
            <TableHeader><TableRow>{table.columns.map((c) => <TableHead key={c.key} scope="col">{c.label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {table.rows.map((r, i) => (
                <TableRow key={i}>
                  {table.columns.map((c) => {
                    const v = r[c.key]
                    return c.numeric && typeof v === "number"
                      ? <TableCell key={c.key} className="font-mono tabular-nums text-right">{fmt.format(v)}</TableCell>
                      : <TableCell key={c.key}>{v}</TableCell>
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : <figure aria-describedby={summaryId}>{children}</figure>}
    </section>
  )
}
