---
sidebar_position: 2
---

# Getting started

Want to use the decoder in Claude, ChatGPT, or Gemini? Follow [Connect your AI assistant](./connect-assistant.md) for one guided setup command on macOS, Linux, or Windows.

## Requirements

- Node.js 20 or later
- pnpm 9

## Install and run

```bash
pnpm install
pnpm dev          # http://localhost:3000 → Lexicon Lab
```

To start the app and docs together, run `pnpm --dir website install --ignore-workspace` once, then `pnpm dev:all` (app on port 3000, docs on port 3001).

You do not need environment variables, API keys or a database install. Copy `.env.example` to `.env.local` to change any default. The comments in that file explain each setting.

## What runs by default

- **Database:** embedded PGlite (real Postgres compiled to WASM). It is stored in `./.data/` and migrated from `./drizzle/`. On first use it is seeded with synthetic data. `pnpm db:reset` wipes it.
- **AI discovery:** a mock model. It knows some slang, makes up some words, misses others and mislabels a couple of sensitive terms. Every mock definition starts with `[Mock]`.
- **Moderation:** a mock endpoint that flags a few synthetic patterns.
- **Auth:** every request is the synthetic, signed-in user "Demo Reviewer".

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm dev:all` | App and docs development servers on ports 3000 and 3001 |
| `pnpm build` / `pnpm start` | Production build / serve (stop `pnpm dev` first, they share `.next/`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (Next.js rules) |
| `pnpm test` | Unit tests (`node:test` via tsx; in-memory database, instant mocks) |
| `pnpm test:ci` | Same tests as `pnpm test`, plus a `junit.xml` report (what GitLab CI runs) |
| `pnpm eval:validate` | Validate `eval/golden-set.json` and print counts |
| `pnpm eval` | Evaluation harness (**yours to build**, see `scripts/eval.ts`) |
| `pnpm aura:plot bussin "goofy ahh" [--out chart.png]` | Chart each term's SIRS lifecycle curve coloured by Aura stage (opens a window, or saves with `--out`). Runs the SIRS plotter vendored in `sirs/`; needs its Python venv (below) |
| `pnpm aura:plot --list` | Print every term `aura:plot` accepts, grouped by generation |
| `pnpm db:generate` | Generate a SQL migration after editing `lib/_stubs/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` (your own hosted Postgres only) |
| `pnpm db:reset` | Delete the local PGlite database |
| `pnpm docs:dev` | Docs site on http://localhost:3001 (install it once with `pnpm --dir website install --ignore-workspace`) |

## Search the docs

The docs site has a search box in the top bar. It uses a local index that is built into the site, so nothing is sent to an outside search service. These docs are private, so the site does not use a hosted search service.

The index is only made by a production build. `pnpm docs:dev` has no search. To try it, run:

```bash
pnpm --dir website build
pnpm --dir website serve   # http://localhost:3000, or add --port 3001
```

The API reference page is not searchable.

## Set up the Aura graphs {#sirs-setup}

Aura graphs (`pnpm aura:plot` and the graph in the AI assistant) are drawn by a small Python program. It needs its own private workspace, called a **venv**, inside the `sirs/` folder. The venv is not shared through Git, so **everyone sets it up once on their own computer**, and again after a fresh download of the project.

If you used the [assistant setup](./connect-assistant.md), it already did this for you. You can skip this section.

### Before you start

1. Install [Node.js](https://nodejs.org/en/download) (version 20 or newer) and run `pnpm install` once in the project folder.
2. Install [Python 3.12](https://www.python.org/downloads/). On Windows, tick **Add Python to PATH** in the installer.

### Steps

1. Open **Terminal** (Mac or Linux) or **PowerShell** (Windows).
2. Go to the project folder. For example: `cd alpha-date`
3. Copy this line, paste it, and press Enter:

```sh
pnpm sirs:setup
```

4. Wait. The first time takes a few minutes while it downloads about 8 packages. Lines of text scrolling past is normal.
5. You are done when you see this message:

```text
SIRS environment ready.
```

It is safe to run again. If nothing needs changing, it finishes in a second.

### Check that it worked

Run this. A chart window opens, or a file called `chart.png` appears in the project folder:

```sh
pnpm aura:plot bussin --out chart.png
```

### If something goes wrong

| What you see | What to do |
|---|---|
| `Python 3.12 (or uv) is required.` | Install Python 3.12 from the link above, close and reopen the terminal, then run `pnpm sirs:setup` again. |
| `pnpm: command not found` | Install Node.js, close and reopen the terminal, then run `corepack enable`. |
| `Run pnpm sirs:setup first` | The venv is missing. Run `pnpm sirs:setup`. |
| `The compiled dtaidistance C library is not available` (Mac) | Run `brew install libomp`, then `uv pip install --python sirs/.venv/bin/python --reinstall --no-binary dtaidistance dtaidistance==2.5.1`. |

## Next steps

- Read [Architecture](./architecture.md) to see how a search moves through the pipeline.
- Read [CI pipeline](./ci.md) before you push, so you can run the same checks locally.
