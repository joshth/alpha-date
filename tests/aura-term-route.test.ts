import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const indexPage = readFileSync("app/lab/aura/page.tsx", "utf8")
const termPagePath = "app/lab/aura/[term]/page.tsx"

test("the Aura index owns the dashboard table", () => {
  assert.match(indexPage, /getAuraDashboardRows/)
  assert.match(indexPage, /dashboardRows=\{rows\}/)
})

test("an Aura term route fits the term without rendering the index table", () => {
  assert.ok(existsSync(termPagePath), "a dynamic Aura term route should exist")
  const termPage = readFileSync(termPagePath, "utf8")
  assert.match(termPage, /fitAuraTerm/)
  assert.match(termPage, /initialTerm=\{term\}/)
  assert.doesNotMatch(termPage, /getAuraDashboardRows|dashboardRows/)
})
