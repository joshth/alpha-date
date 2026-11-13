import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { GET as search } from "@/app/api/search/route"
import { POST as suggest } from "@/app/api/suggestions/route"

const get = (query: string) => search(new Request(`http://localhost/api/search${query}`))
const post = (body: string) => suggest(new Request("http://localhost/api/suggestions", {
  method: "POST", headers: { "Content-Type": "application/json" }, body,
}))

test("GET /api/search rejects a missing or blank q with 400", async () => {
  for (const query of ["", "?q=", "?q=%20%20"]) {
    const response = await get(query)
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /q/)
  }
})

test("GET /api/search returns the search outcome for a seed term", async () => {
  const response = await get("?q=rizz")
  assert.equal(response.status, 200)
  const outcome = await response.json()
  assert.equal(outcome.kind, "found")
  assert.equal(outcome.term.term.toLowerCase(), "rizz")
})

test("GET /api/search runs the safety gate before any lookup", async () => {
  const outcome = await (await get(`?q=${encodeURIComponent("i want to kill myself")}`)).json()
  assert.equal(outcome.kind, "safeguarding")
})

test("POST /api/suggestions rejects a body that is not a JSON object with 400", async () => {
  for (const body of ["not json", "[]", "null", '"rizz"']) {
    const response = await post(body)
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /JSON object/)
  }
})

test("POST /api/suggestions records a safe suggestion with 201", async () => {
  const response = await post(JSON.stringify({ term: "glazing", context: "Heard it in class" }))
  assert.equal(response.status, 201)
  assert.equal((await response.json()).success, true)
})

test("POST /api/suggestions returns the safety verdict when the screen rejects it", async () => {
  const response = await post(JSON.stringify({ term: "i want to kill myself" }))
  assert.equal(response.status, 400)
  const result = await response.json()
  assert.equal(result.success, false)
  assert.notEqual(result.data.action, "safe")
})

async function apiHeaders(env: string) {
  const previous = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: env })
  try {
    const { default: config } = await import("../next.config.mjs")
    const rules: { source: string; headers: { key: string; value: string }[] }[] = (await config.headers?.()) ?? []
    return Object.fromEntries(rules.filter((rule) => rule.source === "/api/:path*").flatMap((rule) => rule.headers.map((h) => [h.key, h.value])))
  } finally {
    Object.assign(process.env, { NODE_ENV: previous })
  }
}

test("in development the API lets the local docs site call it from Swagger UI", async () => {
  const headers = await apiHeaders("development")
  assert.equal(headers["Access-Control-Allow-Origin"], "http://localhost:3001")
  assert.match(headers["Access-Control-Allow-Methods"] ?? "", /GET.*POST/)
  assert.match(headers["Access-Control-Allow-Headers"] ?? "", /Content-Type/)
})

test("in production the API sends no CORS headers", async () => {
  assert.equal((await apiHeaders("production"))["Access-Control-Allow-Origin"], undefined)
})
