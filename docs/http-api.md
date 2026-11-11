---
sidebar_position: 4
title: HTTP API
---

# HTTP API

The Lexicon Lab uses server actions. Two HTTP routes expose the same safety-gated flows for other clients. The interactive reference is at [API reference](pathname:///api).

There is no authentication and no rate limiting. This is a local teaching scaffold. Never expose it publicly.

## GET /api/search

Search for a term. Use the `q` query parameter.

```bash
curl -s "http://localhost:3000/api/search?q=rizz"
```

Responses:

- **200:** a `SearchOutcome` JSON object. The `kind` field is one of:
  - `safeguarding`: the input is a self-harm or abuse signal. The safeguarding panel is shown. No AI call is made.
  - `refused`: the safety gate refused the input.
  - `found`: the term is in the lexicon.
  - `discovered`: AI discovery found the term. It is saved as awaiting review.
  - `not_found`: the term was not found and not discovered.
  - `error`: the search failed. The `message` field says why.
- **400:** `{ "error": "..." }` when `q` is missing or blank.

## POST /api/suggestions

Suggest a missing term. Send a JSON body.

```bash
curl -s -X POST "http://localhost:3000/api/suggestions" \
  -H "Content-Type: application/json" \
  -d '{"term": "rizzz", "context": "Heard it at school"}'
```

The body is a JSON object with these fields:

- `term` (string, required)
- `context` (string, optional)

Responses:

- **201:** `{ "success": true, "message": "..." }`.
- **400:** `{ "success": false, "message": "...", "data": ... }` when validation or the safety screen rejects the suggestion. `data` holds the safety verdict.
- **400:** `{ "error": "..." }` when the body is not a JSON object.

## Related pages

- [Architecture](./architecture.md) explains the order the gate and lookup run in.
- [Getting started](./getting-started.md) explains how to start the dev server on port 3000.
