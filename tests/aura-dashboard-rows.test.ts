import { test } from "node:test"
import assert from "node:assert/strict"
import * as auraFit from "@/lib/aura/fit"

test("Aura dashboard rows keep every term and show no stage for unusable fits", async () => {
  const makeRows = (auraFit as any).createAuraDashboardRows
  assert.equal(typeof makeRows, "function", "Aura dashboard should map fit outcomes into table rows")

  const rows = await makeRows(["bussin", "unknown", "steady"], async (term: string) => {
    if (term === "bussin") return { kind: "fit", fit: { stage: "emerging" } }
    if (term === "unknown") return { kind: "no_data", term, suggestions: [] }
    return { kind: "fit", fit: { stage: null } }
  })

  assert.deepEqual(rows, [
    { term: "bussin", stage: "emerging" },
    { term: "unknown", stage: null },
    { term: "steady", stage: null },
  ])
})
