import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"
import { createDecoderServer } from "@/lib/mcp/server"

async function connect() {
  const server = createDecoderServer({
    checkInputSafety,
    getTermByKey,
    listPublishedTermNames,
    getTermEvents,
    scoreTermLifecycle: () => ({ stage: "peaking", confidence: 0.9, explanation: "At 95% of its 180-day peak, level over 180 days." }),
    now: () => new Date("2026-11-01T00:00:00.000Z"),
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "0.0.0" })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return client
}

test("the server lists three read-only tools that each take a string term", async () => {
  const { tools } = await (await connect()).listTools()
  assert.deepEqual(tools.map((t) => t.name).sort(), ["get_aura", "get_aura_trend", "lookup_term"])
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, tool.name)
    assert.deepEqual(tool.inputSchema.required, ["term"], tool.name)
    assert.equal((tool.inputSchema.properties as { term: { type: string } }).term.type, "string", tool.name)
  }
})

test("lookup_term returns a text answer", async () => {
  const result = await (await connect()).callTool({ name: "lookup_term", arguments: { term: "rizz" } })
  const content = result.content as { type: string; text: string }[]
  assert.equal(content[0].type, "text")
  assert.ok(content[0].text.startsWith("Rizz: Peaking"), content[0].text)
})

test("a term over 100 characters is rejected by the input schema", async () => {
  // SDK 1.32.2 turns the validation error into an isError result, not a thrown error.
  const result = await (await connect()).callTool({ name: "lookup_term", arguments: { term: "x".repeat(101) } })
  assert.equal(result.isError, true)
  assert.match((result.content as { text: string }[])[0].text, /Input validation error/)
})
