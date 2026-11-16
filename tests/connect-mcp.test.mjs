import { test } from "node:test"
import assert from "node:assert/strict"
import { clientConfigPath, mcpLaunch, mergeServerConfig } from "../scripts/connect-mcp.mjs"

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
