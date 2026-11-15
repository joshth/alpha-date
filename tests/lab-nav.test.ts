import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { LAB_NAV } from "../components/lab/nav"

// Every app/lab route that has a page.tsx, as a URL path.
function labRoutes(dir = "app/lab", base = "/lab"): string[] {
  const here = existsSync(join(dir, "page.tsx")) ? [base] : []
  const subdirs = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("["))
  return [...here, ...subdirs.flatMap((d) => labRoutes(join(dir, d.name), `${base}/${d.name}`))]
}

const items = LAB_NAV.flatMap((group) => group.items)

test("the Lab sidebar lists every Lab page and links to Docs", () => {
  assert.deepEqual(items.filter((i) => i.href.startsWith("/lab")).map((i) => i.href).sort(), labRoutes().sort())
  assert.equal(items.find((i) => i.label === "Docs")?.href, "http://localhost:3001")
})

test("the Lab sidebar has an Aura page in its own group", () => {
  const group = LAB_NAV.find((g) => g.items.some((i) => i.href === "/lab/aura"))
  assert.ok(group, "no /lab/aura link")
  assert.equal(group.items.find((i) => i.href === "/lab/aura")?.label, "Aura")
  assert.ok(LAB_NAV.length > 1 && LAB_NAV.every((g) => g.label && g.items.length), "nav is grouped")
})

test("Dedup is its own Lab page in the Analytics group, beside Aura", () => {
  const group = LAB_NAV.find((g) => g.label === "Analytics")
  assert.deepEqual(group?.items.map((i) => [i.href, i.label]), [["/lab/aura", "Aura"], ["/lab/dedup", "Dedup"]])
})
