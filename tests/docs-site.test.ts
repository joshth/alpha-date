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

test("the docs site has local search, pinned to an exact version", () => {
  const dependencies = JSON.parse(read("website/package.json") || "{}").dependencies ?? {}
  assert.match(dependencies["@easyops-cn/docusaurus-search-local"] ?? "", /^\d+\.\d+\.\d+$/)
  assert.match(config, /require\.resolve\('@easyops-cn\/docusaurus-search-local'\)/)
  // The docs are served from the site root, and there is no blog.
  assert.match(config, /docsRouteBasePath: '\/'/)
  assert.match(config, /indexBlog: false/)
})

test("local search still indexes the docs although the site sends noindex to crawlers", () => {
  // The plugin skips pages with a noindex meta tag, which left the search index empty.
  assert.match(config, /forceIgnoreNoIndex: true/)
})

test("the search box placeholder and shortcut hint are dark enough to read", () => {
  // The default placeholder and keys are pale grey on a pale grey pill.
  const css = read("website/src/css/custom.css")
  assert.match(css, /\.navbar__search-input::placeholder\s*\{[^}]*color:\s*var\(--ifm-color-emphasis-700\)/)
  assert.match(css, /\[class\*='searchHint'\]\s*\{[^}]*color:\s*var\(--ifm-color-emphasis-800\)/)
})

test("the README tells developers how to start the docs site and preview its search", () => {
  const readme = read("README.md")
  const section = readme.match(/^## Documentation site\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ?? ""
  assert.match(section, /pnpm --dir website install --ignore-workspace/)
  assert.match(section, /pnpm docs:dev/)
  assert.match(section, /http:\/\/localhost:3001/)
  assert.match(section, /Node(\.js)? 20/)
  assert.match(section, /pnpm --dir website build/)
  assert.match(section, /pnpm --dir website serve/)
  // The mention near the top points at the section.
  assert.match(readme.split("## Quick start")[0], /\(#documentation-site\)/)
})

test("the Project scope page links to the live Google Doc and says it is a copy", () => {
  const lines = read("docs/SCOPE.md").split("\n")
  const body = lines.slice(lines.indexOf("---", 1) + 1)
  const firstHeading = body.findIndex((line) => line.startsWith("# "))
  const intro = body.slice(firstHeading + 1, firstHeading + 8).join("\n")
  assert.match(intro, /\]\(https:\/\/docs\.google\.com\/document\/d\/1LNojWKXzGpgl3YoTBUHLI9rGGd-ex9ao8Ywq3_FkoJs\/edit\?tab=t\.0#heading=h\.ua12c355tyes\)/)
  assert.match(intro, /copy/i)
})

// Pages converted from the team's shared documentation. Each red commit adds one entry.
const sharedPages = [
  {
    file: "docs/features/safety-gate.md",
    title: "Input Safety Gate",
    headings: ["Why it exists", "Interface", "How it decides", "Real examples", "What the user sees", "Checking what the AI writes", "Safety activity reporting", "Measuring the gate", "Configuration", "Files and tests"],
  },
]

for (const page of sharedPages) {
  test(`${page.file} keeps the shared page's title and sections as plain Markdown`, () => {
    const text = read(page.file)
    assert.match(text, new RegExp(`^---\\n(?:.*\\n)*?title: ${page.title}\\n`))
    assert.match(text, new RegExp(`^# ${page.title}\\b`, "m"))
    for (const heading of page.headings) assert.match(text, new RegExp(`^## ${heading.replace(/[()]/g, "\\$&")}\\b`, "m"), heading)
    // No raw HTML outside code fences: pages must stay plain CommonMark.
    const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "")
    assert.doesNotMatch(prose, /<\/?(div|span|a|table|svg|br|img|p|pre)[\s>]/)
  })
}

test("the sidebar groups the feature pages under Features", () => {
  const category = JSON.parse(read("docs/features/_category_.json") || "{}")
  assert.equal(category.label, "Features")
})
