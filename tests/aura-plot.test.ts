import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { plotCommand } from "@/lib/aura/plot-command"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

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

function runScript(...args: string[]) {
  return spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/aura-plot.ts", ...args],
    { encoding: "utf8", env: process.env, timeout: 60_000 })
}

test("aura:plot without terms prints usage and exits 1", () => {
  const result = runScript()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Usage: pnpm aura:plot/)
})

const sirsDir = path.resolve(process.env.SIRS_DIR ?? "../SIRS-gen-alpha")
const sirsReady = existsSync(path.join(sirsDir, ".venv/bin/python")) && existsSync(path.join(sirsDir, "src/sirs/plot_term.py"))

test("aura:plot passes the Python exit code through for an unknown term",
  { skip: !sirsReady && "SIRS-gen-alpha venv or sirs.plot_term not found" }, () => {
    const result = runScript("zzznotaterm")
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Unknown term\(s\): zzznotaterm/)
  })
