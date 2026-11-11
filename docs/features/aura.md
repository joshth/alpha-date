---
sidebar_position: 4
title: Aura Lifecycle
---

# Aura Lifecycle

Slang moves fast. Aura tells parents and educators whether a term is new, at its peak, fading, or already "parent territory", using nothing but anonymous search trends.

## The four stages {#stages}

- **Emerging**: Rising fast. Kids are starting to use it.
- **Peaking**: Close to its all-time high. Everyone is using it.
- **Declining**: Falling clearly from its peak.
- **Parent territory**: Past its peak and flat. If parents know it, it isn't cool any more.

## Interface {#interface}

```ts title="lib/aura/index.ts"
export type AuraStage = "emerging" | "peaking" | "declining" | "parent_territory"

export interface TermEvent { eventType: string; createdAt: Date }   // anonymous: no user, IP or session

export interface AuraScore {
  stage: AuraStage
  confidence: number      // 0–1; low when there is too little data
  explanation: string     // plain English, shown to reviewers
}

export function scoreTermLifecycle(events: TermEvent[], now?: Date): AuraScore | null
```

`AURA_STAGE_LABELS` gives the display names ("Emerging", "Peaking", "Declining", "Parent territory"). The function is pure: it takes events and returns a stage, with no database access.

:::warning[Status]

The stage rule and the lifecycle charts below work today. The TypeScript `scoreTermLifecycle` and the `<AuraBadge />` component are the Sprint 3 work that ports this rule into the app; until then the function throws "not implemented".

:::

## How a term's lifecycle is modelled {#model}

Slang spreads like a cold: people pick it up from each other, use it for a while, then lose interest. Aura fits each term's weekly search counts with a modified **SIRS** model, a standard model of how things spread through a population:

| Share | Meaning for slang |
|----|----|
| **S**usceptible | People who haven't picked the term up yet |
| **I**nfected | People using or searching it now. This curve is what Aura reads. |
| **R**ecovered | People who have moved on |
| Γ (recovery rate) | Changes over time: interest drops faster once a term is everywhere |

```
dS/dt = −β·S·I + ξ·(1 − S − I)
dI/dt =  β·S·I − Γ·I
dΓ/dt =  Γ·(α·I − δ·S)              # time unit: 1 week
```

Fitting gives a smooth, noise-free curve I(t) for each term, so the stage depends on the trend rather than on one noisy week.

## The stage rule {#stage-rule}

Everything is measured relative to the term's own peak, so a niche term and a viral one are judged the same way.

```
r     = I(now) / I_peak                                  # how close to its peak
delta = (I(now) − I(now − 180 days)) / I_peak            # change over the last 180 days
```

The first rule that matches wins:

1.  **Peaking** if `r ≥ 0.80`.

2.  If the curve is **flat** (`|delta| < 0.20`): **parent territory** if the peak has passed, otherwise not yet a stage (the term hasn't taken off).

3.  **Emerging** if `delta ≥ 0.20`.

4.  **Declining** if `delta ≤ −0.20`.

:::tip[Why 0.20?]

Search counts are noisy. The 0.20 floor is the smallest change that still shows up as a clear difference (about two standard errors) between the first and last 60 days of the 180-day window, at realistic daily search rates. Anything smaller can't be told apart from noise, so it isn't called a trend.

:::

## Charting a term {#plot}

`pnpm aura:plot` draws each term's fitted lifecycle curve, coloured by stage, from the SIRS model vendored in `sirs/`.

```
pnpm aura:plot bussin "goofy ahh"            # opens a chart window
pnpm aura:plot bussin --out chart.png        # saves the chart instead
pnpm aura:plot --list                        # every term it accepts, by generation
```

It needs a Python 3.12 environment in `sirs/`, made once:

```
# macOS / Linux
uv venv --python 3.12 sirs/.venv && uv pip install --python sirs/.venv/bin/python -r sirs/requirements.txt
# Windows (PowerShell)
py -3.12 -m venv sirs\.venv; sirs\.venv\Scripts\pip install -r sirs\requirements.txt
```

Set `SIRS_DIR` to use a copy of the plotter somewhere else.

## Test data and privacy {#data}

The seeded database has about six months of **synthetic** search events for each seed term, generated with a known shape so the rule can be tested against the right answer:

| Shape                    | Example terms                                 |
|--------------------------|-----------------------------------------------|
| Emerging                 | `delulu`, `situationship`, `the roman empire` |
| Peaking                  | `rizz`, `skibidi`, `gyatt`                    |
| Declining                | `simp`, `sus`, `npc`                          |
| Faded (parent territory) | `poggers`, `cheugy`, `big yikes`              |

Events carry only a term, an event type and a time. No user ID, IP address or session is stored, and the rule is written to work on real anonymous data, not tuned to the generator.

## Files and tests {#files}

| File | Purpose |
|----|----|
| `lib/aura/index.ts` | The contract: stages, labels and `scoreTermLifecycle` |
| `lib/aura/plot-command.ts`, `scripts/aura-plot.ts` | The `pnpm aura:plot` command |
| `sirs/src/sirs/model.py` | The modified SIRS model |
| `sirs/src/sirs/stages.py` | The stage rule and its noise floor |
| `lib/_stubs/fixtures/synthetic.ts` | Synthetic event shapes |
| `tests/aura-plot.test.ts`, `sirs/tests/` | Tests for the command and the charts |
