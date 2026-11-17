#!/usr/bin/env node
// One local setup command for Claude Desktop, Gemini CLI, and ChatGPT.
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SERVER = "gen-alpha-decoder"

export function mcpLaunch(repo, node, platform = process.platform) {
  const join = platform === "win32" ? path.win32.join : path.posix.join
  return {
    command: node,
    args: [join(repo, "node_modules", "tsx", "dist", "cli.mjs"), "--tsconfig", join(repo, "tsconfig.json"),
      "--conditions=react-server", join(repo, "scripts", "mcp-server.ts")],
  }
}

export function clientConfigPath(client, platform = process.platform, home = os.homedir(), appData = process.env.APPDATA) {
  const join = platform === "win32" ? path.win32.join : path.posix.join
  if (client === "gemini") return join(home, ".gemini", "settings.json")
  if (client !== "claude") throw new Error(`Unknown client: ${client}`)
  if (platform === "darwin") return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
  if (platform === "win32") return join(appData ?? join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
  return join(home, ".config", "Claude", "claude_desktop_config.json")
}

export function mergeServerConfig(existing, launch) {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) throw new Error("Client settings must be a JSON object")
  const servers = existing.mcpServers ?? {}
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) throw new Error("mcpServers must be a JSON object")
  return { ...existing, mcpServers: { ...servers, [SERVER]: launch } }
}

export async function writeClientConfig(client, launch, file = clientConfigPath(client)) {
  const original = existsSync(file) ? await readFile(file, "utf8") : null
  const settings = mergeServerConfig(original ? JSON.parse(original) : {}, launch)
  const output = JSON.stringify(settings, null, 2) + "\n"
  if (output === original) return file
  await mkdir(path.dirname(file), { recursive: true })
  if (original !== null) await copyFile(file, `${file}.backup-${Date.now()}`)
  const temporary = `${file}.tmp-${process.pid}`
  await writeFile(temporary, output)
  await rename(temporary, file)
  return file
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status})`)
}

function pythonCommand() {
  const candidates = process.platform === "win32"
    ? [["py", ["-3.12"]], ["python", []]]
    : [["python3.12", []], ["python3", []]]
  for (const [command, args] of candidates) {
    const check = spawnSync(command, [...args, "-c", "import sys; print(sys.version_info[:2] == (3, 12))"], { encoding: "utf8", shell: process.platform === "win32" })
    if (check.status === 0 && check.stdout.trim() === "True") return [command, args]
  }
  throw new Error("Python 3.12 is required. Install it from https://www.python.org/downloads/ and run this command again.")
}

function installDependencies() {
  const windows = process.platform === "win32"
  const pnpm = windows ? "npx.cmd" : "npx"
  console.log("Installing the decoder and graph support. This can take a few minutes...")
  run(pnpm, ["--yes", "pnpm@9.15.9", "install", "--frozen-lockfile"], { shell: windows })
  const venv = path.join(root, "sirs", ".venv")
  const venvPython = windows ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python")
  if (!existsSync(venvPython)) {
    const [python, args] = pythonCommand()
    run(python, [...args, "-m", "venv", venv], { shell: windows })
  }
  run(venvPython, ["-m", "pip", "install", "-r", path.join(root, "sirs", "requirements.txt")])
}

async function hiddenKey() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Run setup in a local terminal to enter the key privately")
  process.stdout.write("Paste your restricted runtime key (hidden), then press Enter: ")
  return new Promise((resolve, reject) => {
    let value = ""
    process.stdin.setRawMode(true)
    process.stdin.resume()
    const onData = (chunk) => {
      const input = chunk.toString()
      const end = input.search(/[\r\n]/)
      if (end >= 0) {
        value += input.slice(0, end)
        process.stdin.off("data", onData)
        process.stdin.setRawMode(false)
        process.stdout.write("\n")
        resolve(value)
      } else if (input === "\u0003") {
        process.stdin.off("data", onData)
        process.stdin.setRawMode(false)
        reject(new Error("Setup cancelled"))
      } else if (input === "\u007f") value = value.slice(0, -1)
      else value += input
    }
    process.stdin.on("data", onData)
  })
}

async function connectChatgpt(launch, input) {
  const tunnel = process.platform === "win32" ? "tunnel-client.exe" : "tunnel-client"
  const check = spawnSync(tunnel, ["--help"], { stdio: "ignore" })
  if (check.status !== 0) throw new Error("Install tunnel-client from https://github.com/openai/tunnel-client/releases/latest, then run setup again.")
  console.log("Create a tunnel at https://platform.openai.com/settings/organization/tunnels")
  const tunnelId = (await input.question("Paste its tunnel_... ID: ")).trim()
  if (!/^tunnel_[a-zA-Z0-9]+$/.test(tunnelId)) throw new Error("That is not a tunnel ID")
  console.log("Create a restricted runtime key with Tunnels Read + Use at https://platform.openai.com/settings/organization/api-keys")
  input.close()
  const key = process.env.CONTROL_PLANE_API_KEY || await hiddenKey()
  if (!key) throw new Error("A runtime key is required")
  // The command is stored in the tunnel profile; the secret is only in this process environment.
  const command = [launch.command, ...launch.args].map((part) => `"${part.replaceAll('"', '\\"')}"`).join(" ")
  const env = { ...process.env, CONTROL_PLANE_API_KEY: key }
  run(tunnel, ["init", "--force", "--sample", "sample_mcp_stdio_local", "--profile", SERVER,
    "--tunnel-id", tunnelId, "--mcp-command", command], { env })
  run(tunnel, ["doctor", "--profile", SERVER, "--explain"], { env })
  console.log("In ChatGPT: Plugins → Add custom MCP server → Tunnel → select your tunnel → No authentication.")
  console.log("Leave this window open while using ChatGPT. Starting the tunnel now...")
  run(tunnel, ["run", "--profile", SERVER], { env })
}

async function main() {
  const input = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const choice = process.argv[2] ?? (await input.question("Connect to [claude / gemini / chatgpt / all]: ")).trim().toLowerCase()
    if (!["claude", "gemini", "chatgpt", "all"].includes(choice)) throw new Error("Choose claude, gemini, chatgpt, or all")
    installDependencies()
    const launch = mcpLaunch(root, process.execPath)
    for (const client of ["claude", "gemini"]) {
      if (choice !== client && choice !== "all") continue
      const file = await writeClientConfig(client, launch)
      console.log(`${client === "claude" ? "Claude Desktop" : "Gemini CLI"} is connected. Restart it to see the tools. Settings: ${file}`)
    }
    if (choice === "chatgpt" || choice === "all") await connectChatgpt(launch, input)
    else console.log('Try asking: "Get the Aura trend for gyatt and show the graph."')
  } finally {
    input.close()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`Setup stopped: ${error.message}`); process.exitCode = 1 })
}
