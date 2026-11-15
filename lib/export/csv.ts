export type ExportColumn = { key: string; label: string; numeric?: boolean }
export type ExportRow = Record<string, string | number | boolean>

const field = (v: string | number | boolean | undefined) => {
  if (v === undefined) return ""
  let s = String(v)
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (columns: ExportColumn[], rows: ExportRow[]) =>
  [columns.map((c) => field(c.label)), ...rows.map((r) => columns.map((c) => field(r[c.key])))]
    .map((l) => l.join(","))
    .join("\r\n")

export const csvBlobParts = (csv: string) => ["﻿", csv]

export const exportFilename = (base: string, date: Date, ext: string) => {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export"
  const p = (n: number) => String(n).padStart(2, "0")
  return `${slug}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.${ext}`
}

export const csvFilename = (base: string, date: Date) => exportFilename(base, date, "csv")
