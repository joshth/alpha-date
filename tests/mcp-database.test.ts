import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultMcpDatabase } from "@/lib/mcp/database"

test("the MCP server gets its own in-memory database when none is configured", () => {
  const env: NodeJS.ProcessEnv = {}
  defaultMcpDatabase(env)
  assert.equal(env.PGLITE_DATA_DIR, "memory://")
})

test("a shared DATABASE_URL is left alone", () => {
  const env: NodeJS.ProcessEnv = { DATABASE_URL: "postgres://example" }
  defaultMcpDatabase(env)
  assert.equal(env.PGLITE_DATA_DIR, undefined)
})

test("an explicit PGLITE_DATA_DIR is left alone", () => {
  const env: NodeJS.ProcessEnv = { PGLITE_DATA_DIR: "/tmp/mine" }
  defaultMcpDatabase(env)
  assert.equal(env.PGLITE_DATA_DIR, "/tmp/mine")
})
