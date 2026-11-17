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
