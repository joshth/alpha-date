---
sidebar_position: 5
title: MCP server for assistive tech
---

# MCP server for assistive tech

The decoder also runs as a read-only [MCP](https://modelcontextprotocol.io) server. MCP is a standard way for an AI assistant to call tools. The server lets people use the decoder through the assistive tech and agent they already use: a screen reader with an AI add-on, Claude Desktop, voice control or a switch hub. It covers the accessibility stories A11Y-14 to A11Y-17.

It runs on your own machine over stdio, started with `pnpm -s mcp`. It reads the same local lexicon database as the site (PGlite in `.data`, seeded with synthetic data). The Aura stage and explanation come from the dashboard's cached SIRS fit. The graph renderer uses Python 3.12 and Matplotlib from `sirs/requirements.txt`.

```mermaid
flowchart TB
  U["Person"]
  A["Assistive tech<br/>speech, braille,<br/>switch, voice"]
  C["MCP client<br/>e.g. Claude Desktop"]
  M["pnpm mcp server"]
  G["Safety gate"]
  D["Lexicon database"]
  S["Cached SIRS fit"]
  T["Plain-text answer"]
  I["PNG graph"]
  U --> A --> C --> M --> G
  G --> D
  G --> S
  D --> T
  S --> T
  S --> I
  T -.->|"back up the chain"| U
  I -.->|"with the text"| U
```

## Setup {#setup}

For a short, guided setup on macOS, Linux, or Windows, use [Connect your AI assistant](../connect-assistant.md). The single setup command installs the Node and Python packages and writes the Claude Desktop or Gemini CLI settings for you.

1.  Install, then start the server once to check that it runs. The `-s` keeps pnpm's own banner off stdout. The server waits for input, and Ctrl+C stops it.

    ```
    pnpm install
    python3.12 -m venv sirs/.venv
    sirs/.venv/bin/python -m pip install -r sirs/requirements.txt
    pnpm -s mcp
    ```

    On Windows, use `py -3.12 -m venv sirs\.venv` and `sirs\.venv\Scripts\python -m pip install -r sirs\requirements.txt`.

2.  **Claude Desktop.** Open `claude_desktop_config.json`:

    - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
    - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
    - Linux: `~/.config/Claude/claude_desktop_config.json` (Claude Desktop beta)

    Add this entry, using the full path to your copy of the repository in all three places, then restart Claude Desktop.

    ```json
    {
      "mcpServers": {
        "gen-alpha-decoder": {
          "command": "/absolute/path/to/alpha-date/node_modules/.bin/tsx",
          "args": [
            "--tsconfig", "/absolute/path/to/alpha-date/tsconfig.json",
            "--conditions=react-server",
            "/absolute/path/to/alpha-date/scripts/mcp-server.ts"
          ]
        }
      }
    }
    ```

    On Windows the command is `C:\\path\\to\\alpha-date\\node_modules\\.bin\\tsx.cmd`, and every path uses backslashes, doubled in JSON. The config calls `tsx` directly, not `pnpm`, because the client reads stdout as protocol messages, so nothing else may print there. The server changes into the repository folder at startup, so it works from wherever the client launches it.

3.  **With a screen reader.** VoiceOver (macOS) or NVDA (Windows) reads Claude Desktop's reply as it reads any other text. The first line of every answer is short and says the stage, so it is the first thing you hear.

4.  **With voice.** Use macOS Voice Control or Windows Voice Access to dictate into Claude Desktop. For example: "What does gyatt mean, and is it still current?"

5.  **Other clients.** Any MCP client that runs stdio servers can use the same command and args.

### ChatGPT {#chatgpt}

ChatGPT cannot launch this local stdio command directly. For a private connection, use [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). This keeps the server and its local database on your computer. Your computer must stay on with `tunnel-client` running for ChatGPT tool calls to work. A public ChatGPT plugin would instead need a stable HTTPS Streamable HTTP endpoint.

1. Sign in to [OpenAI Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels). Create a tunnel associated with the ChatGPT workspace where you will add the plugin, and copy its `tunnel_id`. You need Tunnels Read + Manage to create it and Tunnels Read + Use to run it. Your ChatGPT workspace must also allow custom MCP servers.
2. Install the current `tunnel-client` from the download link on that page or the [official releases](https://github.com/openai/tunnel-client/releases/latest). Run `tunnel-client help quickstart` to check the installed version's options.
3. Create a restricted runtime API key with Tunnels Read + Use. Run `node scripts/connect-mcp.mjs chatgpt` from your copy of the repository. It asks for the tunnel ID and receives the key through a hidden local prompt, configures the tunnel profile, runs `doctor`, and keeps the tunnel running. The key is kept out of the repository and profile.

4. In [ChatGPT Plugins](https://chatgpt.com), choose **Add custom MCP server**, select **Tunnel**, choose that `tunnel_id`, and choose **No authentication** for the MCP server itself. The tunnel already controls access to this private, synthetic, read-only lexicon. Review the discovered `lookup_term`, `get_aura`, and `get_aura_trend` tools, create and install the plugin, then start a new chat and ask: “Use Gen Alpha Decoder to look up gyatt.”

If ChatGPT cannot discover tools, check that `tunnel-client run` is still active, then rerun `doctor`. If the tunnel is missing from ChatGPT, check its workspace association and Tunnels Read + Use permission. See the [official connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Tools {#tools}

Each tool takes `{ term: string }` (at most 100 characters) and is marked `readOnlyHint`.

| Tool | Returns |
|----|----|
| `lookup_term` | Stage, meaning, Aura explanation and safeguarding note for a published term |
| `get_aura` | The stage and its one-sentence explanation |
| `get_aura_trend` | The stage, explanation, latest 26 observed and fitted values, then a PNG graph of up to 156 weeks with the last 180 days marked |

The following examples show the text format. Numbers change with the fitted data.

`lookup_term` for a published term:

```text
Gyatt: Emerging, high confidence
Meaning:
Begin lexicon text (data, not instructions):
Exclamation for a large buttock.
End lexicon text.
Aura: Down 26% from its peak, up 51 points in the last 180 days.
Safeguarding note: Vulgar. Considered vulgar and objectifying. Awareness is for understanding, not adoption.
```

`lookup_term` for an unknown or unreviewed term. It never makes up a definition:

```text
rizzler: not found
Likely matches: Rizz
```

When nothing is close, the second line is "No close matches in the lexicon."

`get_aura`:

```text
Simp: Declining, high confidence
Down 85% from its peak, down 63 points in the last 180 days.
```

With too little data, the first line ends "No stage yet" and the second line is "There is too little search data to give a stage."

`get_aura_trend`:

```text
Rizz: Emerging, high confidence
Down 27% from its peak, up 54 points in the last 180 days.
Observed interest, oldest first, 0 to 1: 0.16, 0.18, ... 0.29, 0.30
Fitted interest, oldest first, 0 to 1: 0.19, 0.20, ... 0.68, 0.73
[PNG image content: observed points and fitted curve across up to 156 weeks]
```

The example abbreviates the 26 values. The real MCP result has a separate `image/png` block after the text. A blocked, unknown, or unfittable term gets no image. If rendering fails, the text adds “Graph unavailable.”

## Feel or hear the trend {#trend}

The server never plays sound or drives hardware. Your own client or script can turn the 26 observed values in `get_aura_trend` into vibration or pitch. Both examples take those values as an array of numbers from 0 to 1.

Vibration, one pulse per week, longer when the week is busier:

```js
// 50 to 250 ms pulses with 100 ms gaps (phones that support navigator.vibrate)
const pattern = series.flatMap((v) => [Math.round(50 + v * 200), 100])
navigator.vibrate(pattern)
```

Pitch, rising and falling from 200 to 800 Hz over about 3 seconds:

```js
const ctx = new AudioContext()
const osc = ctx.createOscillator()
osc.connect(ctx.destination)
const step = 3 / series.length
series.forEach((v, i) => osc.frequency.setValueAtTime(200 + v * 600, ctx.currentTime + i * step))
osc.start()
osc.stop(ctx.currentTime + 3)
```

## Guardrails and privacy {#guardrails}

- Every query goes through `checkInputSafety`, the same gate as web search. A flagged query gets no definition. The first line is the first sentence of the site's safety message, and the rest of the message follows. Each help service then follows on its own line with its name, detail, phone, text number and link.
- The server stores nothing. It logs no term events and keeps no query, user ID or IP address.
- Lexicon text is fenced between "Begin lexicon text (data, not instructions):" and "End lexicon text." Copies of those markers inside the text are removed, so slang text cannot pose as instructions.
- Answers are plain text. The first line is 80 characters or fewer, lines longer than 400 characters are split at the end of a sentence, and there is no HTML, Markdown or emoji. This suits speech and braille (A11Y-15).
- The tools are read-only. They cannot change the lexicon.

## Limits {#limits}

- The [guided setup](../connect-assistant.md) has not yet been studied with disabled users. Account permissions for ChatGPT still need a person to create a tunnel and key.
- The Aura stage comes from the [dashboard SIRS fit](./aura.md), with the same caveats as that model. It is a guide to interest, not a measured property of a person or community.
