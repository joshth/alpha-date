import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { plotCommand } from "@/lib/aura/plot-command"
import { renderAuraPng } from "@/lib/mcp/graph"
import { fitResult } from "./mcp-fit-fixture"

const hasVenv = existsSync(plotCommand(["x"]).cmd)

test("renders a valid PNG from observed and fitted SIRS data", { skip: !hasVenv && "sirs/.venv missing" }, async () => {
  const result = fitResult()
  if (result.kind !== "fit") throw new Error("missing fit")
  const png = await renderAuraPng(result.fit)
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  assert.ok(png.length > 1000)
  assert.equal(png.toString("ascii", 12, 16), "IHDR")
})

test("missing Python rejects cleanly so the MCP text fallback can run", async () => {
  const result = fitResult()
  if (result.kind !== "fit") throw new Error("missing fit")
  const old = process.env.SIRS_DIR
  process.env.SIRS_DIR = path.join(os.tmpdir(), `a11y67-missing-python-${process.pid}`)
  try {
    await assert.rejects(renderAuraPng(result.fit))
  } finally {
    if (old === undefined) delete process.env.SIRS_DIR
    else process.env.SIRS_DIR = old
  }
})
