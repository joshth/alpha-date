import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { createDecoderTools, type DecoderDeps } from "@/lib/mcp/tools"

const inputSchema = { term: z.string().min(1).max(100) }
const annotations = { readOnlyHint: true, openWorldHint: false }

export function createDecoderServer(deps: DecoderDeps): McpServer {
  const tools = createDecoderTools(deps)
  const server = new McpServer({ name: "gen-alpha-decoder", version: "0.1.0" })
  const register = (name: string, description: string, run: (term: string) => Promise<string>) =>
    server.registerTool(name, { description, inputSchema, annotations }, async ({ term }) => ({
      content: [{ type: "text" as const, text: await run(term) }],
    }))
  register("lookup_term", "Meaning, Aura stage and safeguarding note for a Gen Alpha slang term. Read-only.", tools.lookupTerm)
  register("get_aura", "Aura lifecycle stage, confidence and a one-sentence explanation for a term. Read-only.", tools.getAura)
  register(
    "get_aura_trend",
    "Weekly search trend (26 values, 0 to 1, oldest first) behind a term's Aura stage, for pitch or vibration. Read-only.",
    tools.getAuraTrend,
  )
  return server
}
