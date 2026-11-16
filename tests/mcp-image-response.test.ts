import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { runInNewContext } from "node:vm"
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

test("ChatGPT can load a graph widget from the trend tool", async () => {
  const server = createDecoderServer({
    checkInputSafety, getTermByKey, listPublishedTermNames,
    fitAuraTerm: async () => fitResult(),
    renderAuraPng: async () => Buffer.from("89504e470d0a1a0a", "hex"),
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "widget-test", version: "0.0.0" })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const { tools } = await client.listTools()
  const trend = tools.find((tool) => tool.name === "get_aura_trend")!
  const uri = (trend._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri
  assert.equal(uri, "ui://gen-alpha-decoder/aura-graph-v1.html")
  const resource = await client.readResource({ uri })
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app")
  if (!("text" in resource.contents[0])) throw new Error("Widget resource has no HTML")
  const html = resource.contents[0].text
  assert.match(html, /<img/)
  assert.match(html, /toolResponseMetadata/)
  const result = await client.callTool({ name: "get_aura_trend", arguments: { term: "rizz" } })
  assert.equal((result._meta as { auraGraphPng?: string } | undefined)?.auraGraphPng, Buffer.from("89504e470d0a1a0a", "hex").toString("base64"))
})

test("graph widget renders the standard MCP Apps tool-result notification", async () => {
  const server = createDecoderServer({
    checkInputSafety, getTermByKey, listPublishedTermNames,
    fitAuraTerm: async () => fitResult(),
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "widget-event-test", version: "0.0.0" })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const resource = await client.readResource({ uri: "ui://gen-alpha-decoder/aura-graph-v1.html" })
  if (!("text" in resource.contents[0])) throw new Error("Widget resource has no HTML")
  const script = resource.contents[0].text.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const image = { src: "", alt: "", hidden: true }
  const status = { textContent: "" }
  let onMessage: ((event: unknown) => void) | undefined
  const parent = {}
  runInNewContext(script, {
    document: { getElementById: (id: string) => id === "graph" ? image : status },
    window: { parent, addEventListener: (name: string, listener: (event: unknown) => void) => {
      if (name === "message") onMessage = listener
    } },
  })
  assert.ok(onMessage)
  onMessage({ source: parent, data: { jsonrpc: "2.0", method: "ui/notifications/tool-result",
    params: { _meta: { auraGraphPng: "aGVsbG8=", auraGraphTerm: "gyatt" } } } })
  assert.equal(image.src, "data:image/png;base64,aGVsbG8=")
  assert.equal(image.hidden, false)
  assert.match(image.alt, /gyatt Aura graph/)
})
