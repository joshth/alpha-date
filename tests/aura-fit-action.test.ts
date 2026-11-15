import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { fitAuraTerm } from "@/app/lab/actions"
import { plotCommand } from "@/lib/aura/plot-command"

const hasVenv = existsSync(plotCommand(["x"]).cmd)

test("the Aura fit action gates the term like search, before any fit runs", async () => {
  const res = await fitAuraTerm("i want to kill myself")
  assert.equal(res.kind, "blocked")
  if (res.kind === "blocked") assert.ok(res.message.length > 0)
})

test("the Aura fit action rejects an empty term without fitting", async () => {
  assert.equal((await fitAuraTerm("   ")).kind, "invalid")
})

test("the Aura fit action fits a vendored term end to end", { skip: !hasVenv && "sirs/.venv missing" }, async () => {
  const res = await fitAuraTerm("bussin")
  assert.equal(res.kind, "fit")
  if (res.kind === "fit") assert.equal(res.fit.term, "bussin")
})
