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

test("the docs site serves the OpenAPI spec and renders it with Swagger UI at /api", () => {
  assert.match(config, /staticDirectories: \[[^\]]*'\.\.\/openapi'/)
  assert.match(config, /to: '\/api'/)
  const page = read("website/src/pages/api.tsx")
  assert.match(page, /swagger-ui-react/)
  assert.match(page, /\/openapi\.json/)
})

test("the docs bundle provides Buffer, which Swagger UI needs in the browser", () => {
  // webpack 5 has no Node polyfills; without this /api crashes with "Buffer is not defined".
  assert.ok(JSON.parse(read("website/package.json") || "{}").dependencies?.buffer)
  assert.match(config, /ProvidePlugin\(\{ Buffer: \['buffer', 'Buffer'\] \}\)/)
})

test("the Swagger version badges stay readable: no pale code-block fill behind white text", () => {
  // Infima gives every <pre> a light background, which hides Swagger's white badge text.
  assert.match(config, /customCss: '\.\/src\/css\/custom\.css'/)
  const css = read("website/src/css/custom.css")
  assert.match(css, /\.swagger-ui \.info \.title small pre\s*\{[^}]*background:\s*transparent/)
  assert.match(css, /\.swagger-ui \.info \.title small\s*\{[^}]*background:\s*#434b4f/)
  assert.match(css, /small\.version-stamp\s*\{[^}]*background:\s*#1d632e/)
})
