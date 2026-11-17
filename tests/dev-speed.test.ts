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

test("warmUp requests each route once and survives a failing request", async () => {
  const { warmUp } = await import("../lib/dev-warm")
  const seen: string[] = []
  const fetchFn = async (url: string) => {
    seen.push(url)
    if (url.endsWith("/bad")) throw new Error("boom")
    return new Response("ok")
  }
  await warmUp("http://localhost:3000", ["/lab", "/bad", "/lab/aura"], fetchFn)
  assert.deepEqual(seen, ["http://localhost:3000/lab", "http://localhost:3000/bad", "http://localhost:3000/lab/aura"])
})

test("turbopackRoot widens to the common parent only when node_modules resolves outside the project", async () => {
  const { turbopackRoot } = await import("../lib/turbopack-root.mjs")
  assert.equal(turbopackRoot("/code/app", "/code/app/node_modules"), "/code/app")
  assert.equal(turbopackRoot("/code/app-zoom", "/code/app/node_modules"), "/code")
})
