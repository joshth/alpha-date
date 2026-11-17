import { test } from "node:test"
import assert from "node:assert/strict"
import { auraGraphData } from "@/lib/mcp/graph-data"
import { fitResult } from "./mcp-fit-fixture"

test("graph data is a small numeric series the panel can draw without an image", () => {
  const result = fitResult()
  if (result.kind !== "fit") throw new Error("fixture must fit")
  const data = auraGraphData(result.fit)
  assert.equal(data.term, "Rizz")
  assert.equal(data.startWeek, "2026-05-10")
  assert.equal(data.windowStart, "2026-05-05")
  assert.equal(data.observed.length, 26)
  assert.equal(data.fitted.length, 26)
  assert.equal(data.observed[1], 0.04)
  assert.ok(data.observed.every((value) => Number.isFinite(value) && String(value).length <= 5))
})
