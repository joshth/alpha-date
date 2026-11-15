import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const specFile = "openapi/openapi.json"
const spec = existsSync(specFile) ? JSON.parse(readFileSync(specFile, "utf8")) : {}

// Every app/api/**/route.ts, keyed by its URL path, with its exported methods
// and the status codes its source sets explicitly.
function routes(dir = "app/api"): Map<string, { methods: string[]; statuses: string[] }> {
  const found = new Map<string, { methods: string[]; statuses: string[] }>()
  for (const file of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith("route.ts")) continue
    const source = readFileSync(join(dir, file), "utf8")
    const path = "/" + join(dir, file).replace(/^app\//, "").replace(/\/route\.ts$/, "")
    const methods = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1].toLowerCase())
    const statuses = source.split("\n").filter((line) => line.includes("status")).flatMap((line) => line.match(/\b[1-5]\d\d\b/g) ?? [])
    found.set(path, { methods, statuses })
  }
  return found
}

test("the OpenAPI spec is version 3.1", () => {
  assert.match(spec.openapi ?? "", /^3\.1\.\d+$/)
  assert.ok(spec.info?.title)
})

test("the OpenAPI spec documents exactly the routes under app/api", () => {
  const actual = routes()
  assert.deepEqual(Object.keys(spec.paths ?? {}).sort(), [...actual.keys()].sort())
  for (const [path, { methods }] of actual) {
    assert.deepEqual(Object.keys(spec.paths[path]).sort(), methods.sort(), path)
  }
})

test("every operation documents a success response and each status its route sets", () => {
  for (const [path, { methods, statuses }] of routes()) {
    for (const method of methods) {
      const responses = Object.keys(spec.paths?.[path]?.[method]?.responses ?? {})
      assert.ok(responses.some((code) => code.startsWith("2")), `${method} ${path} has no 2xx response`)
      for (const code of statuses) assert.ok(responses.includes(code), `${method} ${path} is missing ${code}`)
    }
  }
})
