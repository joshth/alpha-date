import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { renderAuraPng } from "@/lib/mcp/graph"
import { fitResult } from "./mcp-fit-fixture"

test("renders a valid PNG from observed and fitted SIRS data", async () => {
  const result = fitResult()
  if (result.kind !== "fit") throw new Error("missing fit")
  const png = await renderAuraPng(result.fit)
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  assert.ok(png.length > 1000)
  assert.equal(png.toString("ascii", 12, 16), "IHDR")
})
