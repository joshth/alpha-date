import { exportFilename, type ExportColumn, type ExportRow } from "./csv"

export const xlsxFilename = (base: string, date: Date) => exportFilename(base, date, "xlsx")

export async function toXlsxBuffer(name: string, columns: ExportColumn[], rows: ExportRow[]) {
  const mod = await import("exceljs")
  const wb = new (mod.default ?? mod).Workbook()
  const ws = wb.addWorksheet(name.replace(/[:\\/?*[\]]/g, "").slice(0, 31) || "Sheet")
  ws.addRow(columns.map((c) => c.label)).font = { bold: true }
  // Strings and numbers are assigned as typed values, so "=SUM(A1)" stays a string cell, never a formula.
  for (const r of rows) ws.addRow(columns.map((c) => r[c.key]))
  columns.forEach((c, i) => {
    const longest = Math.max(c.label.length, ...rows.map((r) => String(r[c.key] ?? "").length))
    ws.getColumn(i + 1).width = Math.min(60, longest + 2)
  })
  return wb.xlsx.writeBuffer()
}
