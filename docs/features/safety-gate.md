---
sidebar_position: 1
title: Input Safety Gate
---

# Input Safety Gate

Every search and suggestion is checked before any AI call. Crisis inputs are stopped and shown Australian support services, sensitive lookups get help resources beside the answer, and the gate fails closed when moderation is unavailable.

:::tip[In one line]

`checkInputSafety(text, surface)` returns `safe`, `refuse` or `safeguarding`, with the reason and which layer decided. The input text is never logged.

:::

## Why it exists {#why}

Gen Alpha Decoder serves a child-adjacent audience. Before schools will adopt it, no unsafe input may reach the AI model, and a young person who types something worrying must be pointed to real help, calmly, every time.

## Interface {#interface}

```ts title="lib/safety/gate.ts"
export type SafetyAction = "safe" | "refuse" | "safeguarding"
export type SafetySurface = "search" | "suggestion"

export interface SafetyVerdict {
  action: SafetyAction
  categories: SafetyCategory[]          // e.g. "suicide_self_harm", "eating_disorder"
  crisis: "self_harm" | "harm_to_others" | null
  decidedBy: "rules" | "moderation" | "fail_closed"
  reason: string                        // machine-readable; never the input text
}

export async function checkInputSafety(text: string, surface?: SafetySurface): Promise<SafetyVerdict>
```

For tests, `createInputSafetyGate(moderator)` builds the same gate with any moderation function injected, so outages and edge cases can be simulated without a network.

## How it decides {#how-it-decides}

The gate runs up to three layers, in order. The first layer that reaches a decision wins.

1.  **Deterministic rules** (`lib/safety/classify.ts`). The text is normalised first: lower-cased, accents removed, look-alike characters undone (`su1c1de`, `unal!ve`), masking symbols dropped and letters repeated three or more times squeezed. Patterns then look for five topics: suicide and self-harm, eating disorders, sexual exploitation, violent threats, and bullying. A **crisis** needs a first-person statement of intent ("I", "I'm", "I'll"…), so "he's going to die of cringe" is not one. A crisis returns `safeguarding` straight away, with no AI and no moderation call.

2.  **Moderation endpoint** (`lib/_stubs/moderation.ts`). In mock mode, a small set of synthetic rules; with a key, the free OpenAI moderation endpoint. Provider categories are mapped onto the five topics.

3.  **Policy** (`lib/safety/policy.ts`) combines both results:

    | Moderation result | Verdict | Reason |
    |----|----|----|
    | Unavailable, or the call throws | *(refuse)* | `moderation_unavailable` (fail closed) |
    | Safe, but the rules saw a sensitive topic | *(safe)* | `sensitive_lookup`: help resources are shown beside the answer |
    | Safe, and the input is a reviewed figurative phrase | *(safe)* | `reviewed_lookup` |
    | Safe, nothing seen | *(safe)* | `no_signal` |
    | Flagged for self-harm intent or instructions, sexual content involving minors, or threatening hate or harassment | *(safeguarding)* | `moderation_safeguarding` |
    | Flagged for anything else | *(refuse)* | `moderation_flagged` |

## Real examples {#examples}

These verdicts come from running the gate in mock mode:

| Input | Action | Decided by | Reason | Categories |
|----|----|----|----|----|
| `rizz` | *(safe)* | moderation | `no_signal` | none |
| `kms` | *(safe)* | moderation | `sensitive_lookup` | suicide_self_harm |
| `pro ana tips` | *(safe)* | moderation | `sensitive_lookup` | eating_disorder |
| `i'm dead` | *(safe)* | moderation | `reviewed_lookup` | none |
| `how to make a bomb` | *(refuse)* | moderation | `moderation_flagged` | violence_threat |
| A first-person statement of intent to self-harm | *(safeguarding)* | rules | `crisis:self_harm` | suicide_self_harm |
| A first-person threat to hurt someone at school | *(safeguarding)* | rules | `crisis:harm_to_others` | violence_threat |
| `rizz` while moderation is down | *(refuse)* | fail_closed | `moderation_unavailable` | none |

:::warning[Why sensitive lookups are allowed]

A parent who sees "kms" in a child's messages needs to know what it means. The lookup is allowed, but help resources are always shown beside the answer, following Mindframe guidance.

:::

### Figurative phrases {#figurative}

Common hyperbole is known slang, not a crisis. Fifteen reviewed phrases, such as `i'm dead`, `you're killing it`, `shoot your shot` and `my plant is going to die`, are matched as whole inputs in `lib/safety/reviewed-lookups.ts`. A crisis signal elsewhere in the input still wins.

## What the user sees {#what-users-see}

Messages are calm and never repeat the input. They come from `lib/safety/responses.ts`:

| Situation | Message |
|----|----|
| Safeguarding | "We can't process this request. If this is affecting you or someone you care about, support is available below." |
| Refused search | "We can't look that up. If something online has upset you, the services below can help." |
| Refused suggestion | "We can't add that suggestion. If something online has upset you, the services below can help." |
| Fail closed | "We couldn't complete the safety check. Please try your search again in a moment." |

### Help resources {#help-resources}

`resourcesFor(categories)` picks services by topic. Every list with a match also includes an option for people outside Australia. Numbers were verified against official sources on 28 September 2026; re-verify before changing them.

| Topic | Services shown |
|----|----|
| Suicide and self-harm | Kids Helpline (1800 55 1800), Lifeline (13 11 14), 13YARN (13 92 76), Suicide Call Back Service (1300 659 467) |
| Eating disorders | Butterfly National Helpline (1800 33 4673), Kids Helpline, Lifeline |
| Bullying and harassment | Kids Helpline, eSafety Commissioner |
| Sexual exploitation | ACCCE, eSafety Commissioner, Kids Helpline |
| Violent threats | Kids Helpline, Crime Stoppers (1800 333 000), eSafety Commissioner |
| Immediate danger | Emergency: 000 in Australia, 112 in the EU |

## Checking what the AI writes {#output-checks}

A safe search can still produce an unsafe definition, so output is checked too. `createOutputSafetyCheck(moderate)` runs the same rules and moderation over generated text.

- **Generated profiles:** `createSafeDiscovery` checks the definition, examples, origin and sentiment before anything is stored.
- **Cached profiles:** `createSafeTermLookup` checks a stored term before it is returned.

If a check fails or moderation is unavailable, the user sees a neutral error and no definition. Nothing is stored.

## Safety activity reporting {#activity}

`createTrackedSafetyGate` wraps the gate and records one anonymous event per decision: the outcome, its categories and the time. Nothing else is stored, and a recording failure never changes a safety decision.

Reviewers open **Safety activity** in the Lexicon Lab (`/lab/safety-activity`), pick a UTC period, and see how many inputs were allowed and stopped, with totals by outcome. An empty period shows no percentage rather than a misleading 0%.

### Incident records {#incidents}

`lib/safety/incidents.ts` defines a validated record for safeguarding follow-up: a reference such as `INC-…`, the surface, crisis kind and categories, UTC and Sydney time, a triage level (`high`, `medium` or `moderation_only`) and open or closed status. An explicit crisis can never be closed as moderation-only. The format is tested and ready; it will be connected to the app once the client's triage rules are agreed.

## Measuring the gate {#evaluation}

The Evaluation Harness runs every safety case in the answer key through the gate and reports:

- **Action agreement:** expected action matched the gate's action.
- **Safeguarding recall:** share of safeguarding cases that reached the safeguarding panel. The target is 100%.
- **Crisis recall:** crisis cases routed to safeguarding with the right crisis kind.
- **False refusal rate:** safe inputs that were refused.

```
pnpm eval                        # search surface
pnpm eval --surface=suggestion   # suggestion surface
```

Safety evaluation always uses mock moderation, so its numbers check the rules and policy, not a real provider.

## Configuration {#configuration}

| Variable | Default | Effect |
|----|----|----|
| `MOCK_LLM` | mock | Set to `false` with `OPENAI_API_KEY` to use the real moderation endpoint. |
| `OPENAI_API_KEY` | unset | Your own key, with a spend cap. Never a production key. |
| `MOCK_MODERATION_LATENCY_MS` | 150 | Simulated moderation delay. |
| `MOCK_MODERATION_FAILURE_RATE` | 0 | Share of calls that fail, to test fail-closed behaviour. `1` fails every call. |

## Files and tests {#files}

| File | Purpose |
|----|----|
| `lib/safety/gate.ts` | The gate and its contract |
| `lib/safety/classify.ts` | Deterministic rules and normalisation |
| `lib/safety/policy.ts` | Combines rules and moderation into a verdict |
| `lib/safety/output.ts` | Checks generated and cached text |
| `lib/safety/resources.ts` | Verified Australian help services |
| `lib/safety/events.ts`, `activity.ts` | Anonymous outcome events and period totals |
| `lib/safety/incidents.ts` | Incident record format |
| `tests/safety-*.test.ts` | Gate, policy, boundaries (unicode, emoji, very long input), outages and recovery |

:::danger[Changing the rules]

Any change to `lib/safety/classify.ts` must keep every `prod-regression` case in the answer key passing, and must add new answer-key cases that show the change.

:::
