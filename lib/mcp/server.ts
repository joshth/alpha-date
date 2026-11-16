import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { createDecoderTools, type DecoderDeps } from "@/lib/mcp/tools"
import { renderAuraPng } from "@/lib/mcp/graph"

const inputSchema = { term: z.string().min(1).max(100) }
const annotations = { readOnlyHint: true, openWorldHint: false }

export function createDecoderServer(deps: DecoderDeps & { renderAuraPng?: typeof renderAuraPng }): McpServer {
  const tools = createDecoderTools(deps)
  const server = new McpServer({ name: "gen-alpha-decoder", version: "0.1.0" })
  const register = (name: string, description: string, run: (term: string) => Promise<string>) =>
    server.registerTool(name, { description, inputSchema, annotations }, async ({ term }) => ({
      content: [{ type: "text" as const, text: await run(term) }],
    }))
  register("lookup_term", "Meaning, Aura stage and safeguarding note for a Gen Alpha slang term. Read-only.", tools.lookupTerm)
  register("get_aura", "Aura lifecycle stage, confidence and a one-sentence explanation for a term. Read-only.", tools.getAura)
  server.registerTool("get_aura_trend", {
    description: "Observed search interest and fitted SIRS curve across 156 weeks as a graph, plus 26 labelled values for speech or braille. Read-only.",
    inputSchema, annotations,
  }, async ({ term }) => {
    const { text, fit } = await tools.getAuraTrendResult(term)
    if (!fit) return { content: [{ type: "text" as const, text }] }
    try {
      const png = await (deps.renderAuraPng ?? renderAuraPng)(fit)
      return { content: [
        { type: "text" as const, text },
        { type: "image" as const, data: png.toString("base64"), mimeType: "image/png" },
      ] }
    } catch (error) {
      console.error("Aura graph unavailable:", error)
      return { content: [{ type: "text" as const, text: `${text}\nGraph unavailable.` }] }
    }
  })
  return server
}
