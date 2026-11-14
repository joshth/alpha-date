# Settings sweep: discovery model comparison

- Dataset: golden set v0.5.0, sha256 `07ec76826238`
- Prompt: `prod-2026-09-27`
- Started: 2026-11-14T13:44:04.108Z
- Split: dev cases only
- Combined from 3 sweep reports (each model's rows come from one report): `2026-11-14T08-38-41-480-sweep-llama3.2_1b+llama3.2_3b+deepseek-r1_1.5b+openai_gpt-4o-mini+openai_gpt-6-astra.json` (llama3.2:1b, llama3.2:3b, deepseek-r1:1.5b); `2026-11-14T13-08-38-308-sweep-openai_gpt-4o-mini+openai_gpt-4o.json` (openai:gpt-4o-mini, openai:gpt-4o); `2026-11-14T12-42-30-714-sweep-openai_gpt-6-astra.json` (openai:gpt-6-astra)
- Rule: acceptable when H1 ≤ 10.0% and recall ≥ 50.0%, with no more than 10.0% of calls failed; then cheapest per 1,000 calls, then fastest.
- Local models are weaker than the production model, so these absolute rates will not transfer; compare the rows with each other.

| Setting | Runs | H1 made-up accepted (pooled) | H1 per-run range | False-accept | Precision | Recall | AUC | Mislabels | Errors | Cost / 1,000 calls | Mean latency | Acceptable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| llama3.2:1b @ 0 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 0.0% (0 / 50; 95% CI 0.0%–7.1%) | n/a (0 / 0) | 0.0% (0 / 78; 95% CI 0.0%–4.7%) | 0.50 | n/a (0 / 0) | 0 of 128 | $0 | 3446 ms | no |
| llama3.2:1b @ 0.4 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 0.0% (0 / 50; 95% CI 0.0%–7.1%) | n/a (0 / 0) | 0.0% (0 / 78; 95% CI 0.0%–4.7%) | 0.50 | n/a (0 / 0) | 0 of 128 | $0 | 4716 ms | no |
| llama3.2:1b @ 0.8 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 0.0% (0 / 50; 95% CI 0.0%–7.1%) | n/a (0 / 0) | 0.0% (0 / 78; 95% CI 0.0%–4.7%) | 0.50 | n/a (0 / 0) | 0 of 128 | $0 | 4662 ms | no |
| llama3.2:1b @ 1.2 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 0.0% (0 / 50; 95% CI 0.0%–7.1%) | n/a (0 / 0) | 0.0% (0 / 78; 95% CI 0.0%–4.7%) | 0.50 | n/a (0 / 0) | 0 of 128 | $0 | 4925 ms | no |
| llama3.2:3b @ 0 | 2 | 50.0% (16 / 32; 95% CI 33.6%–66.4%) | 50.0%–50.0% | 47.8% (22 / 46; 95% CI 34.1%–61.9%) | 73.5% (61 / 83; 95% CI 63.1%–81.8%) | 83.6% (61 / 73; 95% CI 73.4%–90.3%) | 0.68 | 100.0% (10 / 10; 95% CI 72.2%–100.0%) | 9 of 128 | $0 | 14462 ms | no |
| llama3.2:3b @ 0.4 | 2 | 51.4% (18 / 35; 95% CI 35.6%–67.0%) | 50.0%–52.9% | 49.0% (24 / 49; 95% CI 35.6%–62.5%) | 69.6% (55 / 79; 95% CI 58.8%–78.7%) | 76.4% (55 / 72; 95% CI 65.4%–84.7%) | 0.66 | 72.7% (8 / 11; 95% CI 43.4%–90.3%) | 7 of 128 | $0 | 10534 ms | no |
| llama3.2:3b @ 0.8 | 2 | 38.9% (14 / 36; 95% CI 24.8%–55.1%) | 33.3%–44.4% | 40.0% (20 / 50; 95% CI 27.6%–53.8%) | 72.6% (53 / 73; 95% CI 61.4%–81.5%) | 69.7% (53 / 76; 95% CI 58.7%–78.9%) | 0.71 | 72.7% (8 / 11; 95% CI 43.4%–90.3%) | 2 of 128 | $0 | 8959 ms | no |
| llama3.2:3b @ 1.2 | 2 | 48.6% (17 / 35; 95% CI 33.0%–64.4%) | 33.3%–64.7% | 47.9% (23 / 48; 95% CI 34.5%–61.7%) | 68.5% (50 / 73; 95% CI 57.1%–78.0%) | 67.6% (50 / 74; 95% CI 56.3%–77.1%) | 0.63 | 100.0% (11 / 11; 95% CI 74.1%–100.0%) | 6 of 128 | $0 | 9390 ms | no |
| deepseek-r1:1.5b @ 0 | 2 | 0.0% (0 / 12; 95% CI 0.0%–24.2%) | 0.0%–0.0% | 0.0% (0 / 12; 95% CI 0.0%–24.2%) | 100.0% (2 / 2; 95% CI 34.2%–100.0%) | 20.0% (2 / 10; 95% CI 5.7%–51.0%) | 0.60 | n/a (0 / 0) | 106 of 128 ⚠ | $0 | 5705 ms | no |
| deepseek-r1:1.5b @ 0.4 | 2 | 0.0% (0 / 2; 95% CI 0.0%–65.8%) | 0.0%–0.0% | 0.0% (0 / 6; 95% CI 0.0%–39.0%) | n/a (0 / 0) | 0.0% (0 / 5; 95% CI 0.0%–43.4%) | 0.50 | n/a (0 / 0) | 117 of 128 ⚠ | $0 | 5511 ms | no |
| deepseek-r1:1.5b @ 0.8 | 2 | 9.1% (1 / 11; 95% CI 1.6%–37.7%) | 0.0%–16.7% | 15.4% (2 / 13; 95% CI 4.3%–42.2%) | 33.3% (1 / 3; 95% CI 6.1%–79.2%) | 7.7% (1 / 13; 95% CI 1.4%–33.3%) | 0.46 | 100.0% (1 / 1; 95% CI 20.7%–100.0%) | 102 of 128 ⚠ | $0 | 5397 ms | no |
| deepseek-r1:1.5b @ 1.2 | 2 | 10.0% (1 / 10; 95% CI 1.8%–40.4%) | 0.0%–16.7% | 7.1% (1 / 14; 95% CI 1.3%–31.5%) | 87.5% (7 / 8; 95% CI 52.9%–97.8%) | 35.0% (7 / 20; 95% CI 18.1%–56.7%) | 0.64 | 0.0% (0 / 1; 95% CI 0.0%–79.3%) | 94 of 128 ⚠ | $0 | 5317 ms | no |
| openai:gpt-4o-mini @ 0 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 95.8% (46 / 48; 95% CI 86.0%–98.8%) | 59.0% (46 / 78; 95% CI 47.9%–69.2%) | 0.77 | 100.0% (10 / 10; 95% CI 72.2%–100.0%) | 0 of 128 | $0.0813 | 1284 ms | yes |
| openai:gpt-4o-mini @ 0.4 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 95.8% (46 / 48; 95% CI 86.0%–98.8%) | 59.7% (46 / 77; 95% CI 48.6%–70.0%) | 0.79 | 100.0% (10 / 10; 95% CI 72.2%–100.0%) | 1 of 128 | $0.0814 | 2666 ms | yes |
| openai:gpt-4o-mini @ 0.8 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 95.9% (47 / 49; 95% CI 86.3%–98.9%) | 60.3% (47 / 78; 95% CI 49.2%–70.4%) | 0.80 | 100.0% (10 / 10; 95% CI 72.2%–100.0%) | 0 of 128 | $0.0814 | 1162 ms | yes |
| openai:gpt-4o-mini @ 1.2 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 96.3% (52 / 54; 95% CI 87.5%–99.0%) | 66.7% (52 / 78; 95% CI 55.6%–76.1%) | 0.84 | 91.7% (11 / 12; 95% CI 64.6%–98.5%) | 0 of 128 | $0.0866 | 1279 ms | yes |
| openai:gpt-6-astra @ 1 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 97.5% (78 / 80; 95% CI 91.3%–99.3%) | 100.0% (78 / 78; 95% CI 95.3%–100.0%) | 0.98 | 12.5% (2 / 16; 95% CI 3.5%–36.0%) | 0 of 128 | $13.4977 | 7662 ms | yes |
| openai:gpt-4o @ 0 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 96.8% (60 / 62; 95% CI 89.0%–99.1%) | 76.9% (60 / 78; 95% CI 66.4%–84.9%) | 0.86 | 58.3% (7 / 12; 95% CI 32.0%–80.7%) | 0 of 128 | $1.4735 | 1112 ms | yes |
| openai:gpt-4o @ 0.4 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 96.8% (60 / 62; 95% CI 89.0%–99.1%) | 76.9% (60 / 78; 95% CI 66.4%–84.9%) | 0.88 | 50.0% (6 / 12; 95% CI 25.4%–74.6%) | 0 of 128 | $1.4641 | 1071 ms | yes |
| openai:gpt-4o @ 0.8 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 96.6% (57 / 59; 95% CI 88.5%–99.1%) | 73.1% (57 / 78; 95% CI 62.3%–81.7%) | 0.85 | 58.3% (7 / 12; 95% CI 32.0%–80.7%) | 0 of 128 | $1.4417 | 1096 ms | yes |
| openai:gpt-4o @ 1.2 | 2 | 0.0% (0 / 36; 95% CI 0.0%–9.6%) | 0.0%–0.0% | 4.0% (2 / 50; 95% CI 1.1%–13.5%) | 96.7% (59 / 61; 95% CI 88.8%–99.1%) | 75.6% (59 / 78; 95% CI 65.1%–83.8%) | 0.89 | 75.0% (9 / 12; 95% CI 46.8%–91.1%) | 0 of 128 | $1.4740 | 1110 ms | yes |

⚠ Left out of every recommendation, because more than 10.0% of their calls failed and the rates rest on too few answers: deepseek-r1:1.5b @ 0, deepseek-r1:1.5b @ 0.4, deepseek-r1:1.5b @ 0.8, deepseek-r1:1.5b @ 1.2. Rerun these before comparing them.

Pooled intervals count every repeat as a separate draw of the same words, so they are narrower than a fresh set of words would give.

AUC scores each word by the share of repeats that accepted it, then asks how well that score ranks real slang above made-up and ordinary words (1.00 perfect, 0.50 a coin flip). With one repeat, or at temperature 0 where repeats agree, every score is 0 or 1 and AUC equals balanced accuracy.

## Business recommendations

- **Budget pick: openai:gpt-4o-mini @ 0**: cheapest of the 9 setting(s) that pass the rule (H1 10.0% or less and recall 50.0% or more): $0.0813 per 1,000 calls, H1 0.0%, recall 59.0%.
- **Safest pick (fewest made-up meanings): openai:gpt-6-astra @ 1**: lowest H1 (0.0%) of the settings that still find at least 50.0% of real slang (recall 100.0%).
- **Best judgement (highest AUC): openai:gpt-6-astra @ 1**: AUC 0.98: best at telling real slang from made-up and ordinary words (1.00 is perfect, 0.50 is a coin flip).
- **Fastest pick: openai:gpt-4o @ 0.4**: quickest setting that passes the rule: 1.1 s per word on average.
- **Avoid: llama3.2:3b @ 0.4**: highest H1: it accepted 51.4% of made-up words as real slang.

## Decision summary (W18EDATE-72)

Recommended: **openai:gpt-4o-mini @ 0**: H1 0.0% (0 / 36; 95% CI 0.0%–9.6%), recall 59.0% (46 / 78; 95% CI 47.9%–69.2%), $0.0813 per 1,000 calls.

H2 (wrong meanings for real slang) needs human labels of the saved answers (W18EDATE-71, Sprint 3) and is not in this table.
