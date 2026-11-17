import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const scripts: Record<string, string> = JSON.parse(readFileSync("package.json", "utf8")).scripts

test("pnpm dev runs Next with Turbopack so routes compile quickly", () => {
  assert.match(scripts.dev ?? "", /next dev --turbopack/)
})

test("next config trims barrel imports from the heavy UI packages", async () => {
  const { default: config } = await import("../next.config.mjs")
  const packages: string[] = config.experimental?.optimizePackageImports ?? []
  for (const name of ["lucide-react", "recharts", "motion"]) assert.ok(packages.includes(name), name)
})

test("warmRoutes lists every static page under app/, skipping dynamic ones", async () => {
  const { warmRoutes } = await import("../lib/dev-warm")
  const routes = warmRoutes()
  for (const r of ["/", "/lab", "/lab/aura", "/lab/dedup", "/lab/search", "/lab/review", "/lab/eval", "/lab/safety-activity", "/lab/safety-incidents"]) {
    assert.ok(routes.includes(r), r)
  }
  assert.ok(routes.every((r) => !r.includes("[")))
})
