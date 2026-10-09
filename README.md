# Gen Alpha Decoder™ | Date — Lexicon Safety & Quality Pipeline

> **Derived teaching scaffold — not the production Gen Alpha Decoder codebase.**
> This repository contains only the lexicon-pipeline slice of Gen Alpha Decoder™
> (translate-easy.com), rebuilt with mock authentication, mock AI and moderation
> providers, and synthetic data, for the UNSW COMP3900/COMP9900 project with the
> Western Australian AI Hub. It is covered by your NDA: do not publish or share it.
> It contains safety rules and test phrases about self-harm and abuse; treat them with care.

Full scope, schedule and success criteria: [docs/SCOPE.md](docs/SCOPE.md).

## Quick start

Requires Node.js 20+ and pnpm 9.

```bash
pnpm install
pnpm dev          # http://localhost:3000 → Lexicon Lab
```

No environment variables, API keys, or database install are needed. By default:

- **Database:** embedded [PGlite](https://pglite.dev) (real Postgres compiled to WASM), stored
  in `./.data/`, migrated from `./drizzle/` and **seeded with synthetic data** on first use:
  the public seed lexicon, ~6 months of anonymous search events per term, 27 missing-term
  suggestions full of near-duplicates, and 3 AI terms awaiting review. `pnpm db:reset` wipes it.
- **AI discovery:** a mock model that behaves like an imperfect real one (it knows some slang,
  hallucinates some made-up words, misses others, and mislabels a couple of sensitive terms) —
  so your evaluation harness has real errors to find. Every mock definition starts with `[Mock]`.
- **Moderation endpoint:** a mock that flags a few synthetic patterns, with configurable
  latency and failures for testing fail-closed behaviour.
- **Auth:** every request is the synthetic, signed-in user "Demo Reviewer".

Copy `.env.example` to `.env.local` to change any of these (see comments in that file).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve (stop `pnpm dev` first — they share `.next/`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (Next.js rules) |
| `pnpm test` | Unit tests (`node:test` via tsx; in-memory database, instant mocks) |
| `pnpm eval:validate` | Validate `eval/golden-set.json` and print counts |
| `pnpm eval` | Evaluation harness (**yours to build** — see `scripts/eval.ts`) |
| `pnpm db:generate` | Generate a SQL migration after editing `lib/_stubs/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` (your own hosted Postgres only) |
| `pnpm db:reset` | Delete the local PGlite database |

## What already works (baseline)

**Search** → **safety gate** → lexicon lookup → AI discovery → saved as `pending_review` →
**Review queue** (publish/reject). Unknown terms offer a **suggestion** form; suggestions are
listed by count. Try: `Rizz` (found), `brainrot` (discovered), `zorbleflux` (pending,
hallucinated), `kms` (sensitive lookup → help resources), and a first-person crisis
statement (safeguarding panel, no AI call).

The safety baseline is **production's own code**, copied on 2 Oct 2026: the deterministic
classifier (`lib/safety/classify.ts`), verified Australian help resources
(`lib/safety/resources.ts`), the crisis card and help panel (`components/safety/`), and its
59 regression cases (in `eval/golden-set.json`, `source: "prod-regression"`; all pass in
`pnpm test`). Production also runs a separate model-based moderation layer, which is not
included.

## What you are building

| Feature | Start here | Contract |
| --- | --- | --- |
| Input safety gate | `lib/safety/gate.ts`, `lib/_stubs/moderation.ts` | `checkInputSafety(text, surface) → SafetyVerdict` |
| Discovery evaluation harness + golden set (150+) | `scripts/eval.ts`, `eval/golden-set.json`, `lib/eval/golden.ts` | `pnpm eval`; discovery function injected |
| Suggestion normalisation & dedup + triage view | `lib/normalise/index.ts`, `app/lab/review/page.tsx` | `normaliseSuggestion(text)`, `findLikelyMatches(text, candidates)` |
| Aura lifecycle scoring + badge | `lib/aura/index.ts` | `scoreTermLifecycle(events) → AuraScore` |
| *Stretch:* prompt-version comparison in the eval report | `lib/discovery/prompt.ts` | versioned prompt builders |

Each contract file explains what is expected. Where to add value on the safety gate, given
production already has rules: combine rules with the moderation endpoint, **fail closed**,
decide a policy per surface (e.g. today a *suggestion* of a sensitive term like "kms" is
accepted as a normal suggestion — should it be?), and improve the rules wherever your golden
set finds misses or false positives. Every rule fix you prove with a new golden-set case can
go straight into production's regression suite.

### Integration rules (how your work gets into production)

WA AI Hub ports your modules into the production codebase, which you never see. To make
that possible:

1. **Keep production shapes.** `app/types.ts` (`SlangTerm`), `SafetyCategory`/`CrisisKind` in
   `lib/safety/classify.ts`, and the table/column names in `lib/_stubs/schema.ts` mirror
   production. Add fields; don't rename or remove them.
2. **Contract modules are pure.** `lib/safety/gate.ts`, `lib/normalise`, `lib/aura`,
   `lib/discovery/discover.ts` and the eval code take their inputs (events, candidates, model
   function, moderation function) as parameters or via the stub modules — no direct database
   or SDK calls inside them.
3. **Only import from `lib/_stubs/` at the edges** (server actions, stores, the eval script).
   Everything under `lib/_stubs/` is replaced by real implementations in production.
4. **Changes to `lib/safety/classify.ts`** must keep every `prod-regression` case passing, and
   must come with new golden-set cases demonstrating each change.
5. **Schema changes** go through `pnpm db:generate` and are listed in your write-up.

## Rules (non-negotiable)

- **No real data.** Synthetic or publicly documented inputs only — never real user searches,
  real messages, or anything about a real person. Golden-set safety phrases are test strings.
- **Usage events stay anonymous.** Never add user ids, IP addresses, session ids or device data
  to `term_events` — not even synthetic ones. `term_feedback.user_ip` stays null.
- **Credentials live in env vars only.** Never commit `.env*` files (only `.env.example`).
  If you use a real AI key (`MOCK_LLM=false`), it is your own, with a hard monthly spend cap.
- **Your own infrastructure.** `DATABASE_URL`, if set, is your own Postgres (e.g. Neon free
  tier) — never production. Deploy only to your own Vercel sandbox.
- **Out of scope / not in this repo:** production auth, billing, the Educator Workspace,
  school management, the production safety log and incident process, and its model-based
  moderation layer.
- **Help resources** (`lib/safety/resources.ts`) were verified against official sources by
  WA AI Hub. Don't change numbers or wording; propose changes instead.
- **Standards:** Australian English (en-AU) in all UI copy; WCAG 2.2 AA.
- **Dependencies:** WA AI Hub's tooling blocks package versions published in the last few
  days (supply-chain control). Prefer established releases, and justify each new dependency.

## Project layout

```
app/lab/                 Lab pages + server actions (actions.ts)
components/search/       Search panel (client)
components/safety/       Crisis card + help resources (from production)
components/review/       Review buttons (from production)
components/ui/           Shared UI primitives (shadcn/ui, from production)
lib/safety/              Production classifier + resources; gate.ts contract
lib/discovery/           Discovery prompt (production) + discover.ts (injected model)
lib/normalise/           Dedup contract + production similarity helpers
lib/aura/                Lifecycle scoring contract
lib/eval/golden.ts       Golden-set schema and loader
lib/terms-store.ts       Lexicon + anonymous event persistence
lib/feedback.ts          Suggestion persistence (baseline exact-match dedup)
lib/_stubs/              Mock auth, PGlite/Postgres client, schema, seed, mock AI and moderation
eval/golden-set.json     Starter golden set (81 cases)
scripts/eval.ts          Eval CLI entry point
drizzle/                 SQL migrations (generated)
tests/                   Unit tests
docs/SCOPE.md            Approved scope and schedule
```

## Known issues (good first tasks for the Sprint 3 accessibility pass)

Found by an axe-core WCAG 2.2 AA scan of the baseline on 2 Oct 2026. Production uses the same
colours, so fixes here are reusable:

- Destructive buttons and badges (`bg-destructive`, e.g. **Reject**, "Use With Caution") have
  3.76:1 contrast with white text, below the 4.5:1 AA threshold.
- Default (`bg-primary`) buttons drop below 4.5:1 in their hover state (`hover:bg-primary/90`).
- While a toast is visible, the Radix toast viewport reports `aria-hidden-focus` and `list`.

## Mock provider controls

| Variable | Default | Effect |
| --- | --- | --- |
| `MOCK_LLM` | `true` | `false` + `OPENAI_API_KEY` → real discovery model and real moderation endpoint |
| `MOCK_LLM_LATENCY_MS` | `300` | Simulated discovery latency |
| `MOCK_LLM_FAILURE_RATE` | `0` | Fraction of discovery calls that fail |
| `MOCK_MODERATION_LATENCY_MS` | `150` | Simulated moderation latency |
| `MOCK_MODERATION_FAILURE_RATE` | `0` | Fraction of moderation calls that fail — use it to test fail-closed |
| `OPENAI_MODEL` | `gpt-4o-mini` | Discovery model in real mode |

## Team

Gen Alpha Decoder™ | Date · alpha-date@wahub.ai · weekly meeting Tue 3 pm WST.
