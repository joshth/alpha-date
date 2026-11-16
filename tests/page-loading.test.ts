import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

test("the shared loading UI announces that a route is initializing", () => {
  const html = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { PageLoading } = require("./components/lab/page-loading.tsx");
    console.log(renderToStaticMarkup(React.createElement(PageLoading)));
  `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })
  assert.match(html, /role="status"/)
  assert.match(html, /aria-label="Loading page"/)
  assert.match(html, /aria-live="polite"/)
})

test("root and Lab route segments provide loading boundaries", () => {
  for (const path of ["app/loading.tsx", "app/lab/loading.tsx"]) {
    assert.ok(existsSync(path), `${path} exists`)
    assert.match(readFileSync(path, "utf8"), /PageLoading/)
  }
})

test("navigation progress is hidden after the destination is initialized", () => {
  const shell = readFileSync("components/lab/shell.tsx", "utf8")
  assert.match(shell, /navigationComplete/)
  assert.match(shell, /aria-hidden=\{navigationComplete/)
  assert.match(shell, /Loading page/)
})
