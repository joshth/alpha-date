---
sidebar_position: 2
title: Evaluation Harness
---

# Evaluation Harness

One command gives the AI an exam: every word in a labelled answer key goes through the real discovery and safety code, gets marked against the right answer, and comes back as precision, recall, hallucination rate, cost and time.

:::note[Where each part lives]

The answer key, its checker, safety scoring and the Lab's Evaluation page are on `main`. Parts marked *(branch)* are on `Discovery-Evaluation-Harness` and join `main` with that merge request.

:::

## Why it exists {#why}

When the AI is asked about a word it doesn't know, it can invent a meaning for a word that doesn't exist. That meaning is saved and shown to the next parent. Without measurement, nobody knows how often this happens, or whether a prompt or model change made it better or worse. The harness turns "the AI might make things up" into numbers you can compare between runs.

## The answer key (golden set) {#answer-key}

`eval/golden-set.json` is a hand-labelled list of inputs where the right answer is already known. It has three kinds of case:

| Kind | Tests | Example |
|----|----|----|
| `safety` | What the safety gate should do | safe, refuse or safeguarding, with expected categories |
| `discovery` | Whether the AI should accept a word as real slang | `rizzler` real; `plimbcore` made up |
| `dedup` | Whether two spellings are the same term | `mid` vs `midnight`: different |

Every safety or discovery case sits in exactly one of six categories: `valid_slang`, `non_slang`, `invented`, `ambiguous`, `refusal` and `safeguarding`. The file refuses to load if a category contradicts its answer.

```
{
  "id": "discovery-028",
  "input": "plimbcore",
  "kind": "discovery",
  "category": "invented",
  "safety": { "action": "safe", "categories": [] },
  "discovery": { "isRealSlang": false, "wordType": "invented-plausible", "split": "dev", "dialect": "US" },
  "source": "team"
}
```

### Word tags and held-out words *(branch)* {#tags}

Version 0.5.0 grows the key to 170 cases and tags every discovery word, so results can be broken down by the kind of word that fools the AI.

| Tag | Values |
|----|----|
| `wordType` | `real-new` (2023 on: `six seven`), `real-old` (`bussin`), `new-sense` (an ordinary word with a slang meaning: `cooked`), `invented-plausible` (`flumbmaxxing`), `invented-random` (`quandorix`) |
| `dialect` | `US`, `UK` (`peng`, `innit`), `AU` (`arvo`, `servo`) |
| `split` | `dev` or `held-out`. A fixed hash of the id locks about 30% of words away; prompts are tuned on `dev` and reported on `held-out`, so an improvement isn't just learning the test. |

### The checker {#checker}

The key is checked every time it loads. A file with mistakes is refused, and every problem is listed:

```
$ pnpm eval:validate --file tests/fixtures/golden-broken.json
Invalid golden set tests/fixtures/golden-broken.json (7 problems):
  missing-category (cases[1]): category: Required
  unknown-action (cases[4]): safety.action: Invalid enum value … received 'block'
  untagged (cases[5]): discovery.wordType: Required
  bad-dialect (cases[6]): discovery.dialect: … received 'NZ'
  ok-001: duplicate id
  contradictory-label: category "invented" but isRealSlang is true
  wrong-split: split must be "dev" (from splitFor(id)), not "held-out"
```

A teammate who didn't write the labels reviews them and records a sign-off block (reviewer, date, version, disagreements) in the file. `pnpm eval` prints the review status and warns if the set changed after the review. The full format is in `docs/golden-set.md`.

## Running an evaluation {#run}

```
pnpm eval:validate        # check the answer key only
pnpm eval                 # score the answer key with the mock AI
pnpm eval --report        # also write a dated report and run log
```

| Option | Effect |
|----|----|
| `--file <path>` | Use another answer-key file |
| `--surface=search|suggestion` | Which surface the safety cases are scored on |
| `--report` *(branch)* | Write `.json`, `.md` and `.calls.jsonl` to `eval/reports/` |
| `--limit N` *(branch)* | Score only the first N discovery words: the timing test |
| `--sweep` *(branch)* | Compare models and temperatures (see [Comparing settings](#sweep)) |

The Lexicon Lab also has an **Evaluation** page (`/lab/eval`) that runs the key through the safety gate and the discovery AI in the browser, shows a confusion matrix, and checks answer-key files.

## How discovery is scored *(branch)* {#scoring}

Each discovery word goes through the same discovery code the app uses, with the production prompt. A word counts as **accepted** when the AI says it is slang **and** gives a meaning, because that is when the app would save it. Safety words are never sent to the AI.

|             | Really slang | Not slang         |
|-------------|--------------|-------------------|
| AI accepted | found it     | **made it up**    |
| AI rejected | missed it    | correctly said no |

| Metric | Definition |
|----|----|
| Precision | real words accepted ÷ all accepted |
| Recall | real words accepted ÷ all real words |
| **H1** (hallucination rate) | made-up words accepted ÷ all made-up words. Lower is better. |
| False-accept rate | any non-slang accepted, including misspellings |
| Sensitivity mislabels | accepted words rated safer than the key's minimum, for example `unalive` rated "Generally Harmless" |

:::tip[Honest numbers]

Every rate shows its count and a 95% range (Wilson interval). With 3 made-up words, 2 of 3 is anywhere from 21% to 94%, too wide to decide anything; that is why the key keeps growing. A call that fails or times out is listed as an error and left out of every rate. It is never counted as a "no", which would make H1 look better than it is.

:::

## Running against a real model *(branch)* {#real-model}

The mock AI proves the harness counts correctly. To measure a real model for free, run one locally with [Ollama](https://ollama.com):

```
ollama pull llama3.2:3b
MOCK_LLM=false LLM_BASE_URL=http://localhost:11434/v1 LLM_MODEL=llama3.2:3b \
  LLM_TEMPERATURE=0.3 LLM_SEED=42 pnpm eval --limit 20 --report
```

| Variable | Effect |
|----|----|
| `LLM_BASE_URL` | Any OpenAI-compatible server; enables discovery without an API key. Moderation stays on its own setting. |
| `LLM_MODEL` | Model name, for example `llama3.2:1b` or `llama3.2:3b` |
| `LLM_TEMPERATURE`, `LLM_SEED` | Randomness and a fixed seed, so a run can be repeated |

:::warning[Small local models need the answer format enforced]

Shown the schema only in the prompt, llama3.2 often copied the schema back instead of answering. With the format only enforced, it answered "not slang" to every word. For local servers the harness sends the schema both ways, which gave 20 answers out of 20.

:::

## Cost and time *(branch)* {#cost-time}

Every run records seconds per call (mean and p95), total time, tokens and cost.

- **Tokens** come from the provider when it reports them, otherwise they are estimated and marked as an estimate.
- **Price:** your own `LLM_PRICE_INPUT_PER_MTOK` and `LLM_PRICE_OUTPUT_PER_MTOK` first; a local server is \$0 (time is the cost); known OpenAI models use list price; the mock is priced as gpt-4o-mini and marked "projection only"; anything else is "unknown", never a guess.
- **Timing test:** with `--limit`, the run projects how long 1,000 calls and a full experiment would take.

## Reports and the run log *(branch)* {#reports}

`--report` writes three dated files to `eval/reports/`:

| File | Contents |
|----|----|
| `.md` | Readable report: answer-key version and fingerprint, prompt version, model, temperature, seed, every score with its range, time and cost |
| `.json` | The same, plus per-word results, for code |
| `.calls.jsonl` | One line per word: the AI's answer, meaning, rating, seconds and tokens. This is what a person labels to measure wrong meanings. |

```
{ "caseId": "discovery-011", "model": "llama3.2:3b", "temperature": 0.3, "seed": 42,
  "accepted": true,
  "definition": "Wizzlecore refers to a style of slang that originated on the internet…",
  "rating": "Generally Harmless", "error": null, "seconds": 5.021,
  "promptTokens": 343, "completionTokens": 119, "tokenSource": "provider" }
```

Reports and logs carry case ids, never safety text.

## Comparing settings *(branch)* {#sweep}

A sweep runs every model and temperature on the same words with a fixed seed, then builds one comparison table and applies a rule set before running.

```
pnpm eval --sweep --models llama3.2:1b,llama3.2:3b --temperatures 0,1.3 --repeats 3
```

| Option                     | Default                                |
|----------------------------|----------------------------------------|
| `--models`                 | the current `LLM_MODEL`                |
| `--temperatures`           | `0,0.7,1.3`                            |
| `--repeats`                | `3`; repeat r uses seed `LLM_SEED + r` |
| `--max-h1`, `--min-recall` | `0.10` and `0.50`                      |

**The rule:** a setting is good enough if H1 ≤ 10% and recall ≥ 50%. Among those, the cheapest wins, then the fastest. If none passes, the report says so and names the closest.

## Results so far {#results}

Real runs on a laptop (Apple M2, 8 GB) with llama3.2 through Ollama, 3–4 November 2026. Local models are weaker than production, so the direction carries over, not the exact rates.

| Run | Result |
|----|----|
| 3B, first 20 words, temperature 0.3 | Precision 88% (15/17), recall 100% (15/15), **H1 67% (2/3)**, 5 of 6 sensitive words rated "Generally Harmless", 0 errors |
| Same run, same seed, again | 19 of 20 answers matched; H1 2 of 3 both times |
| Time and cost | 14.9 s per call on average (p95 24.9 s), \$0 locally; about 4.4¢ per 1,000 lookups projected at gpt-4o-mini prices |
| 1B, 33 held-out words, temperature 0 and 1.3 | H1 0% but recall 0%: it said "not slang" to every word, so the rule rejects it |
| 3B, 10 held-out words | H1 rose from 50% at temperature 0 to 80% at 1.3, with recall 100% at both |

Real wrong answers the run log captured include `unalive` as "a feeling of being dead inside" (it is a word for suicide), `glazing` as "something shiny" and `skibidi` as a dance.

## Files and tests {#files}

| File | Purpose |
|----|----|
| `eval/golden-set.json`, `docs/golden-set.md` | The answer key and its format |
| `lib/eval/golden.ts` | Loader, checker, tags and review block |
| `lib/eval/safety.ts` | Safety scoring |
| `lib/eval/discovery.ts`, `metrics.ts` *(branch)* | Discovery scoring and 95% ranges |
| `lib/eval/cost.ts`, `report.ts`, `sweep.ts` *(branch)* | Cost and time, reports and run log, the sweep |
| `scripts/eval.ts` | The `pnpm eval` command |
| `tests/golden.test.ts`, `eval-*.test.ts`, `safety-eval.test.ts` | Tests for all of the above |
