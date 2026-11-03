import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

function run(...args: string[]) {
  return spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "scripts/eval.ts", ...args],
    { encoding: "utf8", env: process.env, timeout: 30_000 })
}

test("validation keeps category and review reporting with a selected file", () => {
  const result = run("--file", "eval/golden-set.json", "--validate-only")
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /By category:/)
  assert.match(result.stdout, /Second review:/)
  assert.doesNotMatch(result.stdout, /Safety evaluation:/)
})

test("safety evaluation retains the selected suggestion surface and file", () => {
  const result = run("--file", "eval/golden-set.json", "--surface=suggestion")
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Safety evaluation:/)
  assert.match(result.stdout, /"surface": "suggestion"/)
  assert.match(result.stdout, /Discovery and dedup metrics remain pending/)
})

test("invalid selected files keep golden-set diagnostics", () => {
  const result = run("--file", "tests/fixtures/golden-broken.json", "--validate-only")
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Invalid golden set/)
  assert.match(result.stderr, /duplicate id/)
})

test("missing file values and contradictory surface flags fail before evaluating", () => {
  for (const args of [["--file"], ["--file", "--validate-only"], ["--surface=search", "--surface=suggestion"], ["--unknown"]]) {
    const result = run(...args)
    assert.equal(result.status, 1, args.join(" "))
    assert.match(result.stderr, /Usage:|Choose one evaluation surface/)
    assert.doesNotMatch(result.stdout, /Safety evaluation:/)
  }
})
