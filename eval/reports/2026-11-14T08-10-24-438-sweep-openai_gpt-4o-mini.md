# Settings sweep: discovery model comparison

- Dataset: golden set v0.5.0, sha256 `07ec76826238`
- Prompt: `prod-2026-09-27`
- Started: 2026-11-14T08:10:24.438Z
- Split: held-out cases only
- Rule: acceptable when H1 ≤ 10.0% and recall ≥ 50.0%; then cheapest per 1,000 calls, then fastest.
- Local models are weaker than the production model, so these absolute rates will not transfer; compare the rows with each other.

| Setting | Runs | H1 made-up accepted (pooled) | H1 per-run range | False-accept | Precision | Recall | AUC | Mislabels | Errors | Cost / 1,000 calls | Mean latency | Acceptable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| openai:gpt-4o-mini @ 0 | 2 | 0.0% (0 / 16; 95% CI 0.0%–19.4%) | 0.0%–0.0% | 0.0% (0 / 24; 95% CI 0.0%–13.8%) | 100.0% (30 / 30; 95% CI 88.6%–100.0%) | 71.4% (30 / 42; 95% CI 56.4%–82.8%) | 0.86 | 100.0% (2 / 2; 95% CI 34.2%–100.0%) | 0 | $0.0868 | 1559 ms | yes |

Pooled intervals count every repeat as a separate draw of the same words, so they are narrower than a fresh set of words would give.

AUC scores each word by the share of repeats that accepted it, then asks how well that score ranks real slang above made-up and ordinary words (1.00 perfect, 0.50 a coin flip). With one repeat, or at temperature 0 where repeats agree, every score is 0 or 1 and AUC equals balanced accuracy.

## Business recommendations

- **Budget pick: openai:gpt-4o-mini @ 0**: cheapest of the 1 setting(s) that pass the rule (H1 10.0% or less and recall 50.0% or more): $0.0868 per 1,000 calls, H1 0.0%, recall 71.4%.
- **Safest pick (fewest made-up meanings): openai:gpt-4o-mini @ 0**: lowest H1 (0.0%) of the settings that still find at least 50.0% of real slang (recall 71.4%).
- **Best judgement (highest AUC): openai:gpt-4o-mini @ 0**: AUC 0.86: best at telling real slang from made-up and ordinary words (1.00 is perfect, 0.50 is a coin flip).
- **Fastest pick: openai:gpt-4o-mini @ 0**: quickest setting that passes the rule: 1.6 s per word on average.

## Decision summary (W18EDATE-72)

Recommended: **openai:gpt-4o-mini @ 0**: H1 0.0% (0 / 16; 95% CI 0.0%–19.4%), recall 71.4% (30 / 42; 95% CI 56.4%–82.8%), $0.0868 per 1,000 calls.

H2 (wrong meanings for real slang) needs human labels of the saved answers (W18EDATE-71, Sprint 3) and is not in this table.
