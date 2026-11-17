import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultMcpDatabase } from "@/lib/mcp/database"

test("the MCP server gets its own in-memory database when none is configured", () => {
  const env: Record<string, string | undefined> = {}
  defaultMcpDatabase(env)
  assert.equal(env.PGLITE_DATA_DIR, "memory://")
})

test("a shared DATABASE_URL is left alone", () => {
  const env: Record<string, string | undefined> = { DATABASE_URL: "postgres://example" }
  defaultMcpDatabase(env)
  assert.equal(env.PGLITE_DATA_DIR, undefined)
})

test("an explicit PGLITE_DATA_DIR is left alone", () => {
  const env: Record<string, string | undefined> = { PGLITE_DATA_DIR: "/tmp/mine" }
  defaultMcpDatabase(env)
  assert.equal(env.PGLITE_DATA_DIR, "/tmp/mine")
})
