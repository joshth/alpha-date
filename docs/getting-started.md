---
sidebar_position: 2
---

# Getting started

## Requirements

- Node.js 20 or later
- pnpm 9

## Install and run

```bash
pnpm install
pnpm dev          # http://localhost:3000 → Lexicon Lab
```

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

## The aura:plot Python venv

`pnpm aura:plot` needs a Python 3.12 venv in `sirs/`. Make it once.

macOS or Linux:

```sh
uv venv --python 3.12 sirs/.venv && uv pip install --python sirs/.venv/bin/python -r sirs/requirements.txt
```

Windows (PowerShell):

```powershell
py -3.12 -m venv sirs\.venv; sirs\.venv\Scripts\pip install -r sirs\requirements.txt
```

On macOS, if `aura:plot` fails with "The compiled dtaidistance C library is not available", rebuild that one package from source. You need `brew install libomp` first:

```sh
uv pip install --python sirs/.venv/bin/python --reinstall --no-binary dtaidistance dtaidistance==2.5.1
```

## Next steps

- Read [Architecture](./architecture.md) to see how a search moves through the pipeline.
- Read [CI pipeline](./ci.md) before you push, so you can run the same checks locally.
