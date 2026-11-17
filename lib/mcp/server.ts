import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { createDecoderTools, type DecoderDeps } from "@/lib/mcp/tools"
import { renderAuraPng } from "@/lib/mcp/graph"
import { auraGraphData } from "@/lib/mcp/graph-data"

const inputSchema = { term: z.string().min(1).max(100) }
const annotations = { readOnlyHint: true, openWorldHint: false }
const GRAPH_URI = "ui://gen-alpha-decoder/aura-graph-v5.html"
const graphWidget = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aura trend graph</title><style>
body{margin:0;padding:12px;font:15px system-ui,sans-serif;color:#17212b;background:#fff}
figure{margin:0}img{display:block;width:100%;height:auto}img[hidden]{display:none}#chart svg{display:block;width:100%;height:auto}#chart[hidden]{display:none}figcaption{margin-top:8px;line-height:1.4}
</style></head><body><figure><div id="chart" hidden></div><img id="graph" alt="Aura trend graph" hidden>
<figcaption id="status" role="status">Loading Aura graph…</figcaption></figure><script>
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function chartSvg(g){
  const o=g?.observed,f=g?.fitted;
  if(!Array.isArray(o)||o.length<2||!Array.isArray(f)||f.length!==o.length||![...o,...f].every(Number.isFinite))return null;
  const start=Date.parse(g.startWeek);
  if(!Number.isFinite(start))return null;
  const W=640,H=260,L=40,R=12,T=14,B=30,n=o.length,max=Math.max(1,...o,...f);
  const x=i=>L+i*(W-L-R)/(n-1),y=v=>T+(H-T-B)*(1-v/max);
  const day=i=>new Date(start+i*7*864e5).toISOString().slice(0,10);
  let w=n-1;for(let i=0;i<n;i++){if(day(i)>=g.windowStart){w=i;break;}}
  const label=esc(g.term)+" Aura graph: observed search interest points and fitted SIRS curve over "+n+" weeks; shaded area marks the last 180 days.";
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'
    +'<rect x="'+x(w)+'" y="'+T+'" width="'+(W-R-x(w))+'" height="'+(H-T-B)+'" fill="#dce9f8"/>'
    +'<line x1="'+L+'" y1="'+y(0)+'" x2="'+(W-R)+'" y2="'+y(0)+'" stroke="#8a97a6"/>'
    +'<line x1="'+L+'" y1="'+T+'" x2="'+L+'" y2="'+y(0)+'" stroke="#8a97a6"/>'
    +'<text x="'+(L-6)+'" y="'+(y(0)+4)+'" text-anchor="end" font-size="11" fill="#17212b">0</text>'
    +'<text x="'+(L-6)+'" y="'+(T+4)+'" text-anchor="end" font-size="11" fill="#17212b">'+max.toFixed(1)+'</text>'
    +'<text x="'+L+'" y="'+(H-10)+'" font-size="11" fill="#17212b">'+day(0).slice(0,7)+'</text>'
    +'<text x="'+(W-R)+'" y="'+(H-10)+'" text-anchor="end" font-size="11" fill="#17212b">'+day(n-1).slice(0,7)+'</text>'
    +'<polyline fill="none" stroke="#0b559f" stroke-width="2.2" points="'+f.map((v,i)=>x(i).toFixed(1)+","+y(v).toFixed(1)).join(" ")+'"/>'
    +o.map((v,i)=>'<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="2.2" fill="#a43d1c"/>').join("")
    +'</svg>';
}
function render(metadata=window.openai?.toolResponseMetadata){
  const result=metadata?.mcp_tool_result??metadata?.call_tool_result??metadata;
  const svg=chartSvg(result?.structuredContent?.auraGraph??window.openai?.toolOutput?.auraGraph);
  if(svg){
    const chart=document.getElementById("chart");
    chart.innerHTML=svg;
    chart.hidden=false;
    document.getElementById("graph").hidden=true;
    document.getElementById("status").textContent="Observed points and fitted SIRS curve. The last 180 days are shaded. The tool answer also lists the latest 26 values for speech and braille.";
    return;
  }
  const meta=result?._meta??result;
  const png=result?.content?.find(item=>item.type==="image"&&item.mimeType==="image/png")?.data??meta?.auraGraphPng;
  const term=meta?.auraGraphTerm??"This term";
  const image=document.getElementById("graph");
  const status=document.getElementById("status");
  if(typeof png==="string"&&/^[A-Za-z0-9+/=]+$/.test(png)){
    image.src="data:image/png;base64,"+png;
    image.alt=term+" Aura graph: observed search interest points and fitted SIRS curve over 156 weeks; shaded area marks the last 180 days.";
    image.hidden=false;
    status.textContent="Observed points and fitted SIRS curve. The last 180 days are shaded. The tool answer also lists the latest 26 values for speech and braille.";
  }else{image.hidden=true;status.textContent="Graph unavailable. The trend text remains available in the answer.";}
}
render();
window.addEventListener("message",event=>{
  if(event.source!==window.parent||event.data?.jsonrpc!=="2.0")return;
  if(event.data.method==="ui/notifications/tool-result")render(event.data.params);
  if(event.data.id===1&&event.data.result){
    window.parent.postMessage({jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}},"*");
  }
});
window.parent.postMessage({jsonrpc:"2.0",id:1,method:"ui/initialize",params:{
  protocolVersion:"2026-01-26",appCapabilities:{},appInfo:{name:"Aura graph",version:"1.0.0"}
}},"*");
window.addEventListener("openai:set_globals",event=>render(event.detail?.globals?.toolResponseMetadata??window.openai?.toolResponseMetadata));
</script></body></html>`

export function createDecoderServer(deps: DecoderDeps & { renderAuraPng?: typeof renderAuraPng }): McpServer {
  const tools = createDecoderTools(deps)
  const server = new McpServer({ name: "gen-alpha-decoder", version: "0.1.0" })
  server.registerResource("aura-graph", GRAPH_URI, { mimeType: "text/html;profile=mcp-app" }, async () => ({
    contents: [{ uri: GRAPH_URI, mimeType: "text/html;profile=mcp-app", text: graphWidget,
      _meta: { ui: { prefersBorder: true } } }],
  }))
  const register = (name: string, description: string, run: (term: string) => Promise<string>) =>
    server.registerTool(name, { description, inputSchema, annotations }, async ({ term }) => ({
      content: [{ type: "text" as const, text: await run(term) }],
    }))
  register("lookup_term", "Meaning, Aura stage and safeguarding note for a Gen Alpha slang term. Read-only.", tools.lookupTerm)
  register("get_aura", "Aura lifecycle stage, confidence and a one-sentence explanation for a term. Read-only.", tools.getAura)
  server.registerTool("get_aura_trend", {
    description: "Observed search interest and fitted SIRS curve across 156 weeks as a graph, plus 26 labelled values for speech or braille. Read-only.",
    inputSchema, annotations,
    _meta: { ui: { resourceUri: GRAPH_URI }, "ui/resourceUri": GRAPH_URI, "openai/outputTemplate": GRAPH_URI },
  }, async ({ term }) => {
    const { text, fit } = await tools.getAuraTrendResult(term)
    if (!fit) return { content: [{ type: "text" as const, text }] }
    const structuredContent = { auraGraph: auraGraphData(fit) }
    try {
      const png = await (deps.renderAuraPng ?? renderAuraPng)(fit)
      return { content: [
        { type: "text" as const, text: `${text}\nIf the image is not shown inline, expand this tool result to view the PNG graph.` },
        { type: "image" as const, data: png.toString("base64"), mimeType: "image/png" },
      ], structuredContent, _meta: { auraGraphPng: png.toString("base64"), auraGraphTerm: fit.term } }
    } catch (error) {
      console.error("Aura graph unavailable:", error)
      return { content: [{ type: "text" as const, text: `${text}\nGraph unavailable.` }], structuredContent }
    }
  })
  return server
}
