import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : "")
const config = read("website/docusaurus.config.ts")

test("the docs site is its own package with its own lockfile, outside the app workspace", () => {
  const pkg = JSON.parse(read("website/package.json") || "{}")
  assert.equal(pkg.scripts?.build, "docusaurus build")
  assert.ok(existsSync("website/pnpm-lock.yaml"), "website needs its own lockfile")
  // The app's CI jobs install the root workspace only, so they never pull in Docusaurus.
  assert.doesNotMatch(read("pnpm-workspace.yaml"), /website/)
})

test("the docs site builds from docs/ and fails on broken links", () => {
  assert.match(config, /path: '\.\.\/docs'/)
  assert.match(config, /onBrokenLinks: 'throw'/)
  assert.match(config, /onBrokenMarkdownLinks: 'throw'/)
  // Plain .md stays CommonMark, so `<` and `{` in existing docs don't break the MDX parser.
  assert.match(config, /format: 'detect'/)
})

test("the docs site is never indexed, because the project is under NDA", () => {
  assert.match(config, /noIndex: true/)
})

test("the app's typecheck skips the docs site", () => {
  assert.ok(JSON.parse(read("tsconfig.json")).exclude.includes("website"))
})
