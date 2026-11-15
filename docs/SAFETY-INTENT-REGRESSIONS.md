# Crisis intent regression checks

The classifier keeps whole-input topic detection and self-harm detection. When it has already detected self-harm, a harm-to-others override must have a complete match within one punctuation-delimited clause. This prevents a self-directed verb in one clause from being combined with a school/class reference in an unrelated figurative clause.

The additional clause check applies only after self-harm is detected. Threat-only input retains the existing whole-input matching path, including punctuation-fragmented wording. Input that was already safeguarded for self-harm remains safeguarded.

## Labelled examples

Fourteen synthetic cases in `eval/golden-set.json` use IDs `intent-001` through `intent-014` and source `synthetic-intent-regression`. They cover:

- The measured mixed-context mismatch, with semicolon, period, newline and comma variants.
- An unrelated school reference and both orders of the original phrases.
- Explicit threats before or after self-harm and a single clause containing both risks. Existing harm-to-others priority is retained for complete threats.
- Threat-only wording split by punctuation, two nearby benign examples, and self-harm wording split by punctuation.

The tests check the classifier and both gate surfaces. They also verify that the corrected self-harm verdict stops search dependencies and suggestion writes before moderation. The reviewed lookup tests now assert exact crisis kinds for their mixed-context combinations.

## Evaluation and limits

Run `pnpm exec tsx --conditions=react-server --test tests/safety-intent.test.ts tests/reviewed-lookups.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm eval:validate` and `pnpm eval`.

Compare before and after using the same fourteen labels. Safeguarding action recall and crisis-kind recall are separate metrics: the original bug still blocked the request, but selected the wrong kind of support. Reports use case IDs rather than safety input text.

This is a bounded correction to deterministic rules. It does not establish general language understanding or real-provider accuracy. The existing precedence for simultaneous explicit self-harm and harm-to-others is retained.
