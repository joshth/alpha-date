// pnpm aura:plot bussin "goofy ahh" [--out chart.png] — chart SIRS lifecycle curves coloured by Aura stage.
import { spawnSync } from "node:child_process"
import { plotCommand } from "@/lib/aura/plot-command"

let cmd: ReturnType<typeof plotCommand>
try {
  cmd = plotCommand(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const result = spawnSync(cmd.cmd, cmd.args, { cwd: cmd.cwd, env: cmd.env as NodeJS.ProcessEnv, stdio: "inherit" })
if (result.error) {
  console.error(`Could not run ${cmd.cmd}: ${result.error.message}. Create the sirs/.venv first (see README), or set SIRS_DIR.`)
  process.exit(1)
}
process.exit(result.status ?? 1)
