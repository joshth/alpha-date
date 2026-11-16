console.log = console.error // stdout carries only JSON-RPC; stray logs would corrupt the stream

import path from "node:path"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { moderate } from "@/lib/_stubs/moderation"
import { createAuraFit } from "@/lib/aura/fit"
import { runFit } from "@/lib/aura/fit-command"
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
  fitAuraTerm: createAuraFit({ runFit, getTermEvents, listPublishedTermNames, now: () => new Date() }),
}).connect(new StdioServerTransport()).catch((error) => {
  console.error(error)
  process.exit(1)
})
