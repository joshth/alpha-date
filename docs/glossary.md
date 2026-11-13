---
sidebar_position: 9
title: Glossary
---

# Glossary

Plain-English definitions of the technical terms used in these docs.

## Safety {#safety-terms}

### Safety gate {#safety-gate}

An automatic check that runs on user input before it reaches an AI model, deciding whether the input is safe to process, should be refused, or should be redirected to help resources. See [Input Safety Gate](./features/safety-gate.md).

### Safeguarding resources {#safeguarding}

Trusted support services, such as the eSafety Commissioner and Kids Helpline, shown when input suggests self-harm, abuse or another risk to a young person.

### Fail closed {#fail-closed}

When a safety check can't run (for example, the moderation service is down), the input is refused rather than let through.

## Evaluation {#evaluation-terms}

### Evaluation harness {#evaluation-harness}

A repeatable test program that runs an AI feature against a fixed set of inputs and scores the outputs automatically, so improvements or regressions are measured instead of guessed. See [Evaluation Harness](./features/evaluation-harness.md).

### Golden set (answer key) {#golden-set}

A hand-checked list of example inputs with known correct answers, such as "real slang" or "made-up word", used as the ground truth.

### Precision and recall {#precision-recall}

Precision: of the terms the AI accepted as real, how many actually are. Recall: of the real terms, how many the AI accepted.

### Hallucination (H1) {#hallucination}

When an AI confidently produces false information, such as inventing a definition for a word that isn't real slang. H1 is the share of made-up words the AI accepted.

### 95% range {#confidence-range}

The range the true rate probably falls in, given how many examples were tested. Fewer examples give a wider range.

### Held-out words {#held-out}

Test words kept aside and never used for tuning, so a reported improvement isn't just the system learning the test.

## Data {#data-terms}

### Normalisation and fuzzy matching {#normalisation}

Cleaning text into a standard form (lower-case, trimmed, repeated letters collapsed, spelling variants mapped) and comparing texts by similarity rather than exact equality, so "Rizzz", "rizz " and "RIZZ" are recognised as the same. See [Normalisation and Deduplication](./features/normalisation.md).

### Deduplication {#deduplication}

Identifying and merging duplicate records so each unique item appears once, with a count of how often it was seen.

### Aura (lifecycle and relevance) {#aura}

A score that places a slang term in a lifecycle stage, such as emerging, peaking, declining or parent territory, based on how often it is searched over time. See [Aura Lifecycle](./features/aura.md).

### Synthetic event data {#synthetic-data}

Realistic, generated usage data, such as fake daily search counts, used to build and test analytics without collecting any real user behaviour.

## Development {#development-terms}

### Stubs and mock data {#stubs}

Simplified placeholder components and realistic fake data that simulate real systems safely, without production databases, real accounts or paid services.

### Mock-LLM mode {#mock-llm}

A development setting where AI calls return pre-recorded example responses instead of calling a real AI provider, so the team can build and test at no cost with repeatable results.

### Drizzle {#drizzle}

A tool (an object-relational mapper) for defining database tables and running queries in TypeScript instead of raw SQL.

### Ollama {#ollama}

A free tool that runs open AI models on a laptop. The harness uses it to measure real models without an API key or spend.
