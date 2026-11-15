console.log = console.error // stdout carries only JSON-RPC; stray logs would corrupt the stream

import path from "node:path"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { moderate } from "@/lib/_stubs/moderation"
import { scoreTermLifecycle } from "@/lib/aura"
import { createDecoderServer } from "@/lib/mcp/server"
import { checkInputSafety } from "@/lib/safety/gate"
import { createSafeTermLookup } from "@/lib/safety/safe-term-lookup"
import { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"

// MCP clients start servers from their own folder; the lexicon database lives under the repo root.
process.chdir(path.join(__dirname, ".."))

createDecoderServer({
  checkInputSafety,
  getTermByKey: createSafeTermLookup(getTermByKey, moderate),
  listPublishedTermNames,
  getTermEvents,
  scoreTermLifecycle,
  now: () => new Date(),
}).connect(new StdioServerTransport()).catch((error) => {
  console.error(error)
  process.exit(1)
})
