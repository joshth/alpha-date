import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createDecoderServer } from "@/lib/mcp/server"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, listPublishedTermNames } from "@/lib/terms-store"
import { fitResult, noFit } from "./mcp-fit-fixture"

async function call(term: string, options: { unfittable?: boolean; failGraph?: boolean } = {}) {
  let renders = 0
  const server = createDecoderServer({
    checkInputSafety, getTermByKey, listPublishedTermNames,
    fitAuraTerm: async () => options.unfittable ? noFit : fitResult(),
    renderAuraPng: async () => {
      renders++
      if (options.failGraph) throw new Error("renderer unavailable")
      return Buffer.from("89504e470d0a1a0a", "hex")
    },
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "0.0.0" })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const result = await client.callTool({ name: "get_aura_trend", arguments: { term } })
  return { content: result.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>, renders }
}

test("fitted Aura trend returns readable text followed by a PNG", async () => {
  const { content, renders } = await call("rizz")
  assert.equal(content[0].type, "text")
  assert.match(content[0].text!, /Observed interest/)
  assert.match(content[0].text!, /Fitted interest/)
  assert.match(content[0].text!, /expand this tool result to view the PNG graph/i)
  assert.equal(content[1].type, "image")
  assert.equal(content[1].mimeType, "image/png")
  assert.equal(Buffer.from(content[1].data!, "base64").subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  assert.equal(renders, 1)
})

test("blocked, unknown and unfittable terms return text without rendering", async () => {
  for (const [term, options] of [["I want to kill myself", {}], ["qqqqzzzz", {}], ["rizz", { unfittable: true }]] as const) {
    const { content, renders } = await call(term, options)
    assert.deepEqual(content.map((part) => part.type), ["text"])
    assert.equal(renders, 0)
  }
})

test("render failure keeps the trend text and says Graph unavailable", async () => {
  const { content } = await call("rizz", { failGraph: true })
  assert.deepEqual(content.map((part) => part.type), ["text"])
  assert.match(content[0].text!, /Observed interest/)
  assert.match(content[0].text!, /Graph unavailable\./)
})

test("the trend tool has no graph widget; the PNG in the result is the graph", async () => {
  const server = createDecoderServer({
    checkInputSafety, getTermByKey, listPublishedTermNames,
    fitAuraTerm: async () => fitResult(),
    renderAuraPng: async () => Buffer.from("89504e470d0a1a0a", "hex"),
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "no-widget-test", version: "0.0.0" })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const { tools } = await client.listTools()
  assert.equal(tools.find((tool) => tool.name === "get_aura_trend")?._meta, undefined)
  await assert.rejects(client.listResources())
  const result = await client.callTool({ name: "get_aura_trend", arguments: { term: "rizz" } })
  assert.equal(result.structuredContent, undefined)
  assert.equal(result._meta, undefined)
  assert.deepEqual((result.content as Array<{ type: string }>).map((part) => part.type), ["text", "image"])
})
