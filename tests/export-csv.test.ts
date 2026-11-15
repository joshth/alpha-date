import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { toCsv, csvFilename, csvBlobParts } from "../lib/export/csv"

const cols = [{ key: "a", label: "A" }, { key: "b", label: "B" }]

test("header of labels, CRLF line endings, missing key is empty", () => {
  assert.equal(toCsv(cols, [{ a: "x", b: 1 }, { a: "y" }]), "A,B\r\nx,1\r\ny,")
})

test("fields with comma, quote or newline are quoted with doubled quotes", () => {
  const out = toCsv(cols, [{ a: "a,b", b: 'say "hi"' }, { a: "l1\nl2", b: "ok" }])
  assert.equal(out, 'A,B\r\n"a,b","say ""hi"""\r\n"l1\nl2",ok')
})

test("numbers plain (no separators, no rounding); booleans true/false", () => {
  const out = toCsv(cols, [{ a: 1234567.891234, b: true }, { a: -0.5, b: false }])
  assert.equal(out, "A,B\r\n1234567.891234,true\r\n-0.5,false")
})

test("formula injection: text starting = + - @ tab CR gets a leading apostrophe", () => {
  for (const s of ["=SUM(A1)", "+1", "-1", "@cmd", "\tx", "\rx"]) {
    const line = toCsv(cols, [{ a: s, b: "z" }]).split("\r\n")[1]
    assert.ok(line.startsWith(`'${s[0]}`) || line.startsWith(`"'${s[0]}`), `guarded ${JSON.stringify(s)}`)
  }
  assert.equal(toCsv(cols, [{ a: "=SUM(A1)", b: "" }]).split("\r\n")[1], "'=SUM(A1),")
})

test("apostrophe is added before quoting", () => {
  assert.equal(toCsv(cols, [{ a: "=A1,B1", b: "" }]).split("\r\n")[1], `"'=A1,B1",`)
})

test("real negative numbers are not altered", () => {
  assert.equal(toCsv(cols, [{ a: -3, b: "-3" }]).split("\r\n")[1], "-3,'-3")
})

test("UTF-8 survives and BOM is prepended for blob", () => {
  const csv = toCsv(cols, [{ a: "Δ", b: "😀" }])
  assert.ok(csv.includes("Δ,😀"))
  const parts = csvBlobParts(csv)
  assert.equal(parts.join(""), "\uFEFF" + csv)
})

test("csvFilename slugs the base and appends the date", () => {
  const d = new Date(2026, 10, 4, 12)
  assert.equal(csvFilename("Interest over Time!", d), "interest-over-time-2026-11-04.csv")
  assert.equal(csvFilename("--A  &  B--", d), "a-b-2026-11-04.csv")
  assert.equal(csvFilename("!!!", d), "export-2026-11-04.csv")
})
