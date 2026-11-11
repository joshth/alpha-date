import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { GET as search } from "@/app/api/search/route"

const get = (query: string) => search(new Request(`http://localhost/api/search${query}`))

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
