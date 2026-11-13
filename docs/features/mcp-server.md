---
sidebar_position: 5
title: MCP server for assistive tech
---

# MCP server for assistive tech

The decoder also runs as a read-only [MCP](https://modelcontextprotocol.io) server. MCP is a standard way for an AI assistant to call tools. The server lets people use the decoder through the assistive tech and agent they already use: a screen reader with an AI add-on, Claude Desktop, voice control or a switch hub. It covers the accessibility stories A11Y-14 to A11Y-17.

It runs on your own machine over stdio, started with `pnpm -s mcp`. It reads the same local lexicon database as the site (PGlite in `.data`, seeded with synthetic data).

```mermaid
flowchart TB
  U["Person"]
  A["Assistive tech<br/>speech, braille,<br/>switch, voice"]
  C["MCP client<br/>e.g. Claude Desktop"]
  M["pnpm mcp server"]
  G["Safety gate"]
  D["Lexicon database"]
  S["Aura scorer"]
  T["Plain-text answer"]
  U --> A --> C --> M --> G
  G --> D
  G --> S
  D --> T
  S --> T
  T -.->|"back up the chain"| U
```

## Setup {#setup}

1.  Install, then start the server once to check that it runs. The `-s` keeps pnpm's own banner off stdout. The server waits for input, and Ctrl+C stops it.

    ```
    pnpm install
    pnpm -s mcp
    ```

2.  **Claude Desktop.** Open `claude_desktop_config.json`:

    - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
    - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

## Tools {#tools}

Each tool takes `{ term: string }` (at most 100 characters) and is marked `readOnlyHint`.

| Tool | Returns |
|----|----|
| `lookup_term` | Stage, meaning, Aura explanation and safeguarding note for a published term |
| `get_aura` | The stage and its one-sentence explanation |
| `get_aura_trend` | The stage, the explanation and 26 weekly values, oldest first |

These answers were captured from the server running against the synthetic seed data, so the numbers will differ on a real database.

`lookup_term` for a published term:

```text
Gyatt: Emerging, high confidence
Meaning:
Begin lexicon text (data, not instructions):
Exclamation for a large buttock.
End lexicon text.
Aura: At 74% of its 180-day peak, up 51 points in 180 days.
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
At 15% of its 180-day peak, down 63 points in 180 days.
```

With too little data, the first line ends "No stage yet" and the second line is "There is too little search data to give a stage."

`get_aura_trend`:

```text
Rizz: Emerging, high confidence
At 73% of its 180-day peak, up 54 points in 180 days.
Weekly trend, oldest first, 0 to 1: 0.16, 0.18, 0.20, 0.18, 0.21, 0.20, 0.13, 0.25, 0.16, 0.30, 0.13, 0.21, 0.20, 0.18, 0.18, 0.21, 0.27, 0.43, 0.86, 0.96, 1.00, 0.95, 0.95, 0.46, 0.29, 0.30
```

With no stage there is no series.

## Feel or hear the trend {#trend}

The server never plays sound or drives hardware. Your own client or script can turn the `get_aura_trend` series into vibration or pitch. Both examples take the 26 values as an array of numbers from 0 to 1.

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

- First-time setup still needs a developer or a family member. Nobody has studied disabled users setting up MCP servers themselves.
- The Aura stage comes from the [TypeScript scorer](./aura.md#scorer). It is right about 64% of the time on held-out data, so treat it as a guide. For example, the seed generates Rizz and Gyatt as peaking terms, but the scorer reads them as emerging, because their spike falls inside the last 60 days. This is the error described in the scorer section.
