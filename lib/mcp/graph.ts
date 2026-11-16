import { spawn } from "node:child_process"
import type { SirsFit } from "@/lib/aura/fit-command"
import { plotCommand } from "@/lib/aura/plot-command"

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex")
const MAX_PNG_BYTES = 5 * 1024 * 1024

/** Render the same 156-week observed and fitted series used by the dashboard. */
export function renderAuraPng(fit: SirsFit): Promise<Buffer> {
  const command = plotCommand([fit.term])
  return new Promise((resolve, reject) => {
    const child = spawn(command.cmd, ["-m", "sirs.mcp_graph"], {
      cwd: command.cwd,
      env: { ...process.env, ...command.env, MPLBACKEND: "Agg" },
      stdio: "pipe",
    })
    const chunks: Buffer[] = []
    let size = 0
    let stderr = ""
    const timer = setTimeout(() => child.kill(), 30_000)
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_PNG_BYTES) child.kill()
      else chunks.push(chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString().slice(0, 1000) })
    child.on("error", (error) => { clearTimeout(timer); reject(error) })
    child.on("close", (code) => {
      clearTimeout(timer)
      const png = Buffer.concat(chunks)
      if (code !== 0 || size > MAX_PNG_BYTES || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
        reject(new Error(`Aura graph rendering failed: ${stderr || `exit ${code}`}`))
      } else resolve(png)
    })
    child.stdin.end(JSON.stringify(fit))
  })
}
