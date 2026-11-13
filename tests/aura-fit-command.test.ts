import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fitCommand, parseFit, runFit, MODEL_VERSION } from "@/lib/aura/fit-command"
import { plotCommand } from "@/lib/aura/plot-command"

const env = { SIRS_DIR: "/x/sirs" }
const fixture = {
  term: "bussin", generation: "gen_z", modelVersion: "v", now: "2026-11-13", weeks: ["2026-11-06", "2026-11-13"],
  counts: [1, 2], fitted: { I: [0.1, 0.2], S: [0.9, 0.8], R: [0, 0], Gamma: [0.1, 0.1] },
  r: 0.5, delta: 0.1, stage: "emerging", confidence: 0.8, peakWeek: "2026-11-13", windowStart: "2026-11-06",
}

test("fitCommand resolves python, cwd and env like plotCommand", () => {
  const fit = fitCommand("bussin", {}, env, "/code")
  const plot = plotCommand(["x"], env, "/code")
  assert.equal(fit.cmd, plot.cmd)
  assert.equal(fit.cwd, plot.cwd)
  assert.equal(fit.env.PYTHONPATH, plot.env.PYTHONPATH)
  assert.deepEqual(fit.args, ["-m", "sirs.fit_term", "bussin", "--json"])
  assert.equal(fit.input, undefined)
})

test("fitCommand adds --now, and --counts with the JSON on stdin", () => {
  const counts = { weeks: ["2026-11-13"], counts: [3] }
  const fit = fitCommand("bussin", { now: "2026-11-13", counts }, env, "/code")
  assert.deepEqual(fit.args, ["-m", "sirs.fit_term", "bussin", "--json", "--now", "2026-11-13", "--counts"])
  assert.equal(fit.input, JSON.stringify(counts))
})

test("fitCommand rejects an empty term", () => {
  assert.throws(() => fitCommand("  ", {}, env, "/code"))
  assert.throws(() => fitCommand("", {}, env, "/code"))
})

test("parseFit accepts a valid fit and a null stage", () => {
  const parsed = parseFit(JSON.stringify(fixture))
  assert.equal(parsed.kind, "fit")
  assert.equal(parseFit(JSON.stringify({ ...fixture, stage: null })).kind, "fit")
})

test("parseFit maps the no_data error line", () => {
  assert.deepEqual(parseFit(JSON.stringify({ error: "no_data", term: "zzz" })), { kind: "no_data" })
})

test("parseFit throws on bad JSON or a wrong shape", () => {
  assert.throws(() => parseFit("not json"))
  assert.throws(() => parseFit(JSON.stringify({ ...fixture, counts: [1] })))
  assert.throws(() => parseFit(JSON.stringify({ ...fixture, stage: "viral" })))
})

test("MODEL_VERSION matches fit_term.py", () => {
  const py = readFileSync("sirs/src/sirs/fit_term.py", "utf8")
  assert.equal(MODEL_VERSION, py.match(/^MODEL_VERSION\s*=\s*"([^"]+)"/m)?.[1])
})

const live = fitCommand("bussin")
const ready = existsSync(live.cmd) && existsSync(path.join(live.cwd, "src/sirs/fit_term.py"))

test("live: a vendored term fits", { skip: !ready && "SIRS venv or sirs.fit_term not found" }, async () => {
  const { code, stdout } = await runFit(fitCommand("bussin"))
  assert.equal(code, 0)
  const parsed = parseFit(stdout)
  assert.equal(parsed.kind, "fit")
  assert.equal(parsed.kind === "fit" && parsed.fit.term, "bussin")
})

test("live: an unknown term is no_data", { skip: !ready && "SIRS venv or sirs.fit_term not found" }, async () => {
  const { stdout } = await runFit(fitCommand("zzznotaterm"))
  assert.equal(parseFit(stdout).kind, "no_data")
})
