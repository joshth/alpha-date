import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { clientConfigPath, mcpLaunch, mergeServerConfig, writeClientConfig } from "../scripts/connect-mcp.mjs"

test("one launcher works on macOS, Linux and Windows", () => {
  for (const platform of ["darwin", "linux", "win32"]) {
    const root = platform === "win32" ? "C:\\Users\\Ada\\alpha-date" : "/home/ada/alpha-date"
    const node = platform === "win32" ? "C:\\Program Files\\nodejs\\node.exe" : "/usr/bin/node"
    const launch = mcpLaunch(root, node, platform)
    assert.equal(launch.command, node)
    assert.ok(launch.args[0].endsWith(platform === "win32" ? "tsx\\dist\\cli.mjs" : "tsx/dist/cli.mjs"))
    assert.ok(launch.args.at(-1).endsWith(platform === "win32" ? "scripts\\mcp-server.ts" : "scripts/mcp-server.ts"))
  }
})

test("client settings paths cover all desktop operating systems", () => {
  assert.equal(clientConfigPath("claude", "darwin", "/Users/ada"), "/Users/ada/Library/Application Support/Claude/claude_desktop_config.json")
  assert.equal(clientConfigPath("claude", "win32", "C:\\Users\\Ada", "C:\\Users\\Ada\\AppData\\Roaming"), "C:\\Users\\Ada\\AppData\\Roaming\\Claude\\claude_desktop_config.json")
  assert.equal(clientConfigPath("claude", "linux", "/home/ada"), "/home/ada/.config/Claude/claude_desktop_config.json")
  assert.equal(clientConfigPath("gemini", "linux", "/home/ada"), "/home/ada/.gemini/settings.json")
  assert.equal(clientConfigPath("gemini", "win32", "C:\\Users\\Ada"), "C:\\Users\\Ada\\.gemini\\settings.json")
})

test("adding the decoder preserves other client settings and servers", () => {
  const existing = { theme: "dark", mcpServers: { other: { command: "other-server" } } }
  const launch = { command: "/usr/bin/node", args: ["server.js"] }
  assert.deepEqual(mergeServerConfig(existing, launch), {
    theme: "dark", mcpServers: { other: { command: "other-server" }, "gen-alpha-decoder": launch },
  })
  assert.deepEqual(existing, { theme: "dark", mcpServers: { other: { command: "other-server" } } })
})

test("setup keeps a backup and does not duplicate settings on rerun", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mcp-onboarding-"))
  const file = path.join(dir, "settings.json")
  try {
    await writeFile(file, JSON.stringify({ theme: "dark" }))
    await writeClientConfig("gemini", { command: "node", args: ["server.js"] }, file)
    await writeClientConfig("gemini", { command: "node", args: ["server.js"] }, file)
    const settings = JSON.parse(await readFile(file, "utf8"))
    assert.equal(settings.theme, "dark")
    assert.deepEqual(Object.keys(settings.mcpServers), ["gen-alpha-decoder"])
    assert.equal((await readdir(dir)).filter((name) => name.includes("backup-")).length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("the generated launcher discovers the three real MCP tools", async () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const launch = mcpLaunch(repo, process.execPath)
  const transport = new StdioClientTransport({ command: launch.command, args: launch.args, cwd: repo })
  const client = new Client({ name: "onboarding-test", version: "0.0.0" })
  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["get_aura", "get_aura_trend", "lookup_term"])
  } finally {
    await client.close()
  }
})
