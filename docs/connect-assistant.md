---
sidebar_position: 3
title: Connect your AI assistant
---

# Connect your AI assistant

You can ask Gen Alpha Decoder about a word in Claude Desktop, Gemini CLI, or ChatGPT. The decoder stays on your computer. It can explain a published word, say where its Aura is in the lifecycle, and show a graph of observed search interest and the fitted curve. The graph also has a written description with numbers for speech and braille.

## Before you start

Install these once on your computer:

1. [Git](https://git-scm.com/downloads), to copy the project.
2. [Node.js](https://nodejs.org/en/download) (version 20 or newer), to run the decoder.
3. [Python 3.12](https://www.python.org/downloads/), to calculate and draw Aura trends. On Windows, tick **Add Python to PATH** in the installer.

You also need the assistant you want to use: [Claude Desktop](https://claude.ai/download), [Gemini CLI](https://github.com/google-gemini/gemini-cli), or [ChatGPT](https://chatgpt.com). Claude Desktop for Linux is currently in beta. This setup uses a local Gemini CLI. [Gemini Apps custom MCP connections](https://support.google.com/gemini/answer/17209137) currently require a supported US personal account, so Gemini CLI is the route for people elsewhere, including Australia.

## Copy and connect in one go

Open **Terminal** on Mac or Linux, or **PowerShell** on Windows. Copy the line for your computer, paste it, and press Enter. The setup asks which assistant you want. Type `claude`, `gemini`, `chatgpt`, or `all`.

**Mac or Linux**

```sh
git clone https://github.com/joshth/alpha-date.git && cd alpha-date && node scripts/connect-mcp.mjs
```

**Windows PowerShell**

```powershell
git clone https://github.com/joshth/alpha-date.git; if ($LASTEXITCODE -eq 0) { Set-Location alpha-date; node scripts/connect-mcp.mjs }
```

The setup downloads the project packages and creates its Python environment. This may take a few minutes the first time. It adds the decoder to your chosen assistant's settings and keeps any other tools you already have. If it changes an existing settings file, it saves a dated backup next to it. You can run setup again after moving the project folder.

For **Claude Desktop**, quit and reopen Claude after setup. For **Gemini CLI**, start a new Gemini session and run `/mcp list` to check that `gen-alpha-decoder` appears. Ask: **“Get the Aura trend for gyatt and show me the graph.”**

### If you chose ChatGPT

ChatGPT needs one account step because it cannot start a program on your computer by itself. Setup will guide you through it:

1. In [OpenAI Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels), create a tunnel connected to the ChatGPT workspace you will use. Copy its `tunnel_...` ID.
2. Download and install [OpenAI's tunnel client](https://github.com/openai/tunnel-client/releases/latest) for your computer. Create a restricted runtime key with **Tunnels Read + Use** in [Platform API keys](https://platform.openai.com/settings/organization/api-keys).
3. Paste the tunnel ID when setup asks. Paste the runtime key at the **hidden** prompt on your computer. Keep the setup window open while using ChatGPT; closing it stops the tunnel.
4. In ChatGPT, open **Plugins → Add custom MCP server → Tunnel**. Select your tunnel, choose **No authentication** for the MCP server, and create the plugin. Start a new chat and ask the same sample question.

The runtime key is never saved in this project or written into the tunnel profile. Do not paste it into a chat, screenshot, or public issue. If you do not see the tunnel in ChatGPT, check that it belongs to the right workspace and that your account has **Tunnels Read + Use**. Your ChatGPT workspace must allow custom MCP servers.

## What to expect

`get_aura_trend` gives a 156-week picture: orange points are observed search interest, a blue line is the fitted SIRS curve, and a pale band marks the last 180 days. Below the stage and explanation, the text answer lists the latest 26 observed and fitted values. If a graph cannot be drawn, the text still works and says **“Graph unavailable.”** Unknown, blocked, and unfittable words do not produce a graph.

Your computer must be on for the local decoder to work. Claude Desktop and Gemini CLI start it when they need it. ChatGPT also needs the tunnel window running.

For technical details or other MCP clients, see [MCP server for assistive tech](./features/mcp-server.md).
