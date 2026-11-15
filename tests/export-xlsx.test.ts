import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ExcelJS from "exceljs"
import { toXlsxBuffer, xlsxFilename } from "../lib/export/xlsx"

const cols = [{ key: "t", label: "Term" }, { key: "n", label: "Score", numeric: true }]
const load = async (name: string, rows: Record<string, string | number | boolean>[]) => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(Buffer.from(await toXlsxBuffer(name, cols, rows)) as never)
  return wb
}

test("module imports exceljs lazily", () => {
  const src = readFileSync("lib/export/xlsx.ts", "utf8")
  assert.ok(src.includes('import("exceljs")'))
  assert.doesNotMatch(src, /from ["']exceljs["']/)
})

test("one sheet, bold header, labels, number vs string cells", async () => {
  const wb = await load("Trend", [{ t: "rizz", n: 1.5 }])
  assert.equal(wb.worksheets.length, 1)
  const ws = wb.worksheets[0]
  assert.equal(ws.name, "Trend")
  assert.equal(ws.getRow(1).getCell(1).font?.bold, true)
  assert.deepEqual([1, 2].map((i) => ws.getRow(1).getCell(i).value), ["Term", "Score"])
  assert.equal(ws.getRow(2).getCell(2).type, ExcelJS.ValueType.Number)
  assert.equal(ws.getRow(2).getCell(2).value, 1.5)
  assert.equal(ws.getRow(2).getCell(1).type, ExcelJS.ValueType.String)
})

test("sheet name is sanitised and truncated to 31 chars", async () => {
  const long = (await load("x".repeat(50), [])).worksheets[0].name
  assert.equal(long.length, 31)
  const bad = (await load("a:b\\c/d?e*f[g]h", [])).worksheets[0].name
  assert.doesNotMatch(bad, /[:\\/?*[\]]/)
  assert.ok(bad.length > 0)
})

test("columns auto-widen to longest cell, capped at 60", async () => {
  const ws = (await load("W", [{ t: "a".repeat(25), n: 1 }, { t: "b".repeat(200), n: 2 }])).worksheets[0]
  assert.equal(ws.getColumn(1).width, 60)
  const ws2 = (await load("W", [{ t: "a".repeat(25), n: 1 }])).worksheets[0]
  assert.ok((ws2.getColumn(1).width ?? 0) >= 25)
})

// Unlike CSV, which Excel re-parses on open, an .xlsx stores text as a typed string, so Excel never evaluates it.
// The guard is the cell TYPE: user-submitted text must come back unchanged and as a string, never as a formula.
test("formula-looking text is stored as plain text, unchanged and never as a formula", async () => {
  const ws = (await load("S", [{ t: "=SUM(A1)", n: 1 }, { t: "+1", n: 1 }, { t: "-1", n: 1 }, { t: "@x", n: 1 }])).worksheets[0]
  const expected = ["=SUM(A1)", "+1", "-1", "@x"]
  expected.forEach((v, i) => {
    const c = ws.getRow(i + 2).getCell(1)
    assert.equal(c.type, ExcelJS.ValueType.String)
    assert.notEqual(c.type, ExcelJS.ValueType.Formula)
    assert.equal(c.value, v)
  })
})

test("xlsxFilename", () => {
  assert.equal(xlsxFilename("Interest over Time", new Date(2026, 10, 4, 12)), "interest-over-time-2026-11-04.xlsx")
  assert.equal(xlsxFilename("", new Date(2026, 0, 9, 12)), "export-2026-01-09.xlsx")
})
