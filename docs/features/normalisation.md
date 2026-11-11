---
sidebar_position: 3
title: Normalisation and Deduplication
---

# Normalisation and Deduplication

"Brain Rot!", "brain-rot" and "brainrot" are the same word. Normalisation turns them into one key, so a search finds the existing term without an AI call, and similar suggestions are surfaced as likely matches instead of piling up as new terms.

## Why it exists {#why}

Without it, every spelling variant looks like a new word. Each one triggers an AI call, gets its own record, and adds to a reviewer's queue. Normalisation saves AI calls and reviewer time, and keeps the shared lexicon clean.

## Interface {#interface}

```ts title="lib/normalise/index.ts"
/** Canonical form used as the dedup key for a suggestion. */
export function normaliseSuggestion(text: string): string

/** Best matches for `text` among existing terms and suggestions, best first. */
export function findLikelyMatches(text: string, candidates: string[]): LikelyMatch[]

export interface LikelyMatch {
  candidate: string                         // the term this one probably duplicates
  score: number                             // 1 = same key; between 0 and 1 = a guess
  reason: "same_key" | "trigram" | "stem"
  signals?: { trigram: number; stem: boolean }
}
```

Both are pure functions: no database or network access.

## Building the key {#normalise}

`normaliseSuggestion` applies three steps, in this order:

1.  **Spell out separated single digits.** `6 7` and `6-7` become `sixseven`, matching "six seven". Multi-digit numbers (`67`, `520`) and leetspeak (`l33t`) are left alone, because their meaning depends on culture.

2.  **Reduce to letters and digits.** Lower-case, strip accents (`café` → `cafe`) and remove everything that isn't a letter or digit. It is Unicode-aware, so non-Latin input still gets a key.

3.  **Collapse long letter runs.** Three or more of the same letter become two: `RIZZZZ` → `rizz`.

Real outputs:

| Input | Key |
|----|----|
| `Brain Rot!` | `brainrot` |
| `brain-rot` | `brainrot` |
| `RIZZZZ`, `rizz ` | `rizz` |
| `6 7`, `6-7`, `six seven` | `sixseven` |
| `67` | `67` (left alone) |
| `Café` | `cafe` |
| `gyat!!` | `gyat` |
| `brainrottt` | `brainrott` (one key away; caught by fuzzy matching) |

:::note[Keys are versioned]

`NORMALISER_VERSION` increases whenever the key rules change. Each stored term keeps the version its key was made with, so stale keys can be found and rebuilt.

:::

## Finding likely matches {#matching}

`findLikelyMatches` compares the input's key with each candidate's key:

1.  **Same key:** score 1, reason `same_key`.

2.  **Too short to guess:** if either key is shorter than 4 characters, no fuzzy match is tried. This stops `mid` merging with `midnight` and `sus` with `sussy baka`.

3.  **Trigram similarity:** the share of three-letter chunks the two keys have in common (the same measure Postgres `pg_trgm` uses).

4.  **Stem fallback:** only when trigram alone misses, a simple suffix check (`-ing`, `-ed`, `-s`) adds weight, so `glaze` can still find `glazing`. The two are blended so the score stays below 1, which is kept for exact keys.

5.  Matches scoring under the threshold (0.5) are dropped.

Real outputs against a small lexicon:

| Input        | Best match | Score | Reason                          |
|--------------|------------|-------|---------------------------------|
| `6 7`        | six seven  | 1.00  | `same_key`                      |
| `mid`        | mid        | 1.00  | `same_key` (and not midnight)   |
| `brainrottt` | brain rot  | 0.73  | `trigram`                       |
| `skibbidi`   | skibidi    | 0.70  | `trigram`                       |
| `glaze`      | glazing    | 0.58  | `stem` (trigram alone was 0.40) |
| `gyat!!`     | Gyatt      | 0.57  | `trigram`                       |
| `sus`        | none       |       | too short to guess              |
| `zorbleflux` | none       |       | nothing similar                 |

:::warning[A guess is never merged automatically]

Only an exact key (score 1) is treated as the same term. Anything below 1 is shown to a reviewer, who decides.

:::

## Where the app uses it {#in-the-app}

- **Search:** the lexicon is looked up by key, so `Brain Rot!` finds `brainrot`. When an existing term is found, no AI call is made and an `ai_call_avoided` event is recorded.
- **AI calls avoided:** the search page shows a running count of AI calls saved this way, with an animated badge.
- **Storage:** every term is saved with its `term_key` and key version. The key has a plain (not unique) index, because two different terms may share a key and a reviewer should see both.
- **Review queue:** suggestions are listed by count. Showing each suggestion's likely matches beside it is the next step; `findLikelyMatches` is built and tested for it.

## Tuning and limits {#tuning}

| Constant               | Value | Meaning                                 |
|------------------------|-------|-----------------------------------------|
| `MATCH_THRESHOLD`      | 0.5   | Lowest score reported as a likely match |
| `MIN_FUZZY_KEY_LENGTH` | 4     | Shorter keys only ever match exactly    |
| `STEM_WEIGHT`          | 0.3   | How much the suffix signal adds         |
| `DEFAULT_MATCH_LIMIT`  | 3     | Matches returned by default             |

These are starting values. They are measured against the labelled duplicate pairs in the [answer key](./evaluation-harness.md#answer-key), such as `mid` vs `midnight` (different) and `brain rot` vs `brainrot` (same).

:::note[Known limits]

The suffix list is English-only and has no real morphology. `6 7` and `67` get different keys on purpose, because a shared key would merge a 2025 meme with an ordinary number; showing such pairs to a reviewer is planned.

:::

## Files and tests {#files}

| File | Purpose |
|----|----|
| `lib/normalise/index.ts` | The key and likely-match rules |
| `lib/normalise/similarity.ts` | Base key and trigram similarity, copied from production |
| `lib/search.ts`, `lib/terms-store.ts` | Lookup by key and the `ai_call_avoided` event |
| `tests/normalise.test.ts`, `findLikelyMatches.test.ts`, `fuzzyMatches.test.ts`, `termKey.test.ts` | Tests for the key, matching and storage |
