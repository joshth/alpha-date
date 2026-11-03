import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { plotCommand } from "@/lib/aura/plot-command"

test("plotCommand runs sirs.plot_term with the SIRS venv and src on PYTHONPATH", () => {
  const cmd = plotCommand(["bussin", "goofy ahh"], { SIRS_DIR: "/x/sirs" }, "/code/alpha-date")
  assert.equal(cmd.cmd, "/x/sirs/.venv/bin/python")
  assert.deepEqual(cmd.args, ["-m", "sirs.plot_term", "bussin", "goofy ahh"])
  assert.equal(cmd.cwd, "/x/sirs")
  assert.equal(cmd.env.PYTHONPATH, "/x/sirs/src")
})

test("plotCommand defaults SIRS_DIR to SIRS-gen-alpha beside the repo", () => {
  assert.equal(plotCommand(["bussin"], {}, "/code/alpha-date").cwd, "/code/SIRS-gen-alpha")
})

test("plotCommand without terms throws a usage message", () => {
  assert.throws(() => plotCommand([], {}, "/code/alpha-date"), /Usage: pnpm aura:plot/)
})
