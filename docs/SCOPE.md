# **Gen Alpha Decoder™ | Date \- Project Scope and Schedule**

# **Glossary of Technical Terms**

**Content Moderation / Safety Gate:** An automatic check that runs on user input *before* it reaches an AI model, deciding whether the input is safe to process, should be refused, or should be redirected to help resources.

**Safeguarding Resources:** Trusted support services (e.g., the eSafety Commissioner, Kids Helpline) shown to a user when their input suggests self-harm, abuse, or another risk to a young person.

**Evaluation Harness:** A repeatable test program that runs an AI feature against a fixed set of inputs and scores the outputs automatically, so improvements (or regressions) can be measured instead of guessed.

**Golden Set:** A hand-checked list of example inputs with known correct answers (e.g., "real slang" vs "made-up word"), used by the evaluation harness as the ground truth.

**Precision & Recall:** Two accuracy measures. Precision: of the terms the AI accepted as real, how many actually are. Recall: of the real terms, how many the AI accepted.

**Hallucination:** When an AI model confidently produces information that is false — for example, inventing a definition for a word that is not real slang.

**Normalisation & Fuzzy Matching:** Cleaning text into a standard form (lower-case, trimmed, repeated letters collapsed, common spelling variants mapped) and comparing texts by similarity rather than exact equality, so "Rizzz", "rizz " and "RIZZ" are recognised as the same suggestion.

**Deduplication:** Identifying and merging duplicate records so each unique item appears once, with a count of how often it was seen.

**Lifecycle / Relevance Scoring ("Aura"):** A score that places a slang term in a lifecycle stage (e.g., emerging, peaking, declining, "parent territory") based on how often it is searched over time.

**Synthetic Event Data:** Realistic, generated usage data (e.g., fake search counts per day) used to build and test analytics without collecting any real user behaviour.

**Stubs & Mock Data:** Simplified placeholder components and realistic fake data used during development to simulate real system behaviours safely, without access to production databases, real accounts, or paid services.

**Mock-LLM Mode:** A development setting where AI calls return pre-recorded example responses (fixtures) instead of calling a real AI provider, so the team can build and test at zero cost and with repeatable results.

**Drizzle:** A modern tool (Object-Relational Mapper) that lets developers define database tables and run queries in TypeScript instead of writing raw SQL.

# **Context**

A small student team to work on a bounded slice of the Gen Alpha Decoder™ codebase over \~7 weeks (3 Oct – 21 Nov). Team strengths are yet to be confirmed at kickoff; this scope assumes working familiarity with TypeScript, React, and Next.js, and is structured so the core can be delivered by any competent team, with a clearly marked stretch item.

Gen Alpha Decoder™ (live at translate-easy.com) is a slang decoder for parents and educators. Its lexicon grows through AI: unknown searches are classified and, if judged real, given a full AI-generated profile; users can also suggest missing terms. Exploration of the repo (Next.js 15 App Router / TypeScript, Drizzle \+ Postgres, Vercel) found three gaps in this lexicon pipeline, all in a self-contained slice (**lib/term-cache.ts**, the term-discovery logic in **app/actions.ts**, and the **terms**, **term\_events**, and **term\_feedback** tables):

1. **No safety gate** in front of the AI calls, and no safeguarding resources shown on self-harm/abuse-adjacent inputs — a hard requirement before schools will adopt the product.
2. **No measurement** of how accurate AI term discovery is: nothing detects when the model accepts made-up words or hallucinates definitions.
3. **No normalisation** of user suggestions and **no relevance signal**: near-duplicate suggestions pile up separately, and there is no way to tell whether a term is emerging or already outdated.

Students need their own repo (**joshth/alpha-date**) containing **only** this slice — not the full Gen Alpha Decoder codebase (authentication, Stripe billing, educator workspace, school/seat management, real user records) — as a **fresh scaffold with stubbed interfaces**. Because Gen Alpha Decoder serves a child-adjacent audience, the scaffold and scope statement bake in the product's privacy rules from day one: usage events are never linked to identity, suggestion IP addresses are replaced with synthetic values, env-var-only credentials, and a mock-LLM mode so no paid AI key is required to work.

# **1\. Project scope statement (for 3 Oct approval)**

**Title:** Gen Alpha Decoder Lexicon Safety & Quality Pipeline

**Problem:** Every search and suggestion can trigger AI calls with no safety screening, the accuracy of AI term discovery is unmeasured, user suggestions are stored without deduplication, and the product cannot tell users whether a term is current. This limits trust with schools and lets low-quality entries into a shared lexicon.

### **Scope (in):**

* **Input safety gate:** a **checkInputSafety(text)** module that classifies input (safe / refuse / safeguarding-redirect) before any AI call, using a free moderation endpoint plus local rules, with a clear, calm safeguarding panel pointing to the eSafety Commissioner and Kids Helpline. Fails closed on error.
* **Discovery evaluation harness:** a golden set (at least 150 labelled inputs: real current slang, outdated slang, misspellings, made-up words, sensitive and adversarial inputs) and a CLI that runs the discovery logic against it and reports precision, recall, hallucination rate, and cost per run — in mock mode and, optionally, against a real model. The team then improves the discovery prompt/logic and shows the measured difference.
* **Suggestion normalisation & deduplication:** normalise and fuzzy-match incoming suggestions (and match them against existing lexicon terms) so variants merge into one record with a combined count; a review-queue triage view that sorts suggestions by count and shows likely matches.
* **"Aura" lifecycle scoring:** a **scoreTermLifecycle(events)** function that assigns each term a stage (emerging / peaking / declining / parent territory) from search-event trends, tested on synthetic event data, plus an accessible badge component.
* **Stretch (only if core is done by Demo 2):** compare two prompt versions side by side in the evaluation report.

### **Scope (out, non-negotiable):**

* No access to **lib/auth\***, **lib/stripe.ts**, **app/api/webhooks/**, **app/api/admin/**, the Educator Workspace (lesson plans, discussion prompts), or school/seat management. Any field that could be personal data (suggester IP, account) is **replaced with synthetic/mock data** in the scaffold — never real data.
* Usage events stay anonymous: no user IDs, IPs, or session identifiers may be added to event data, even synthetic.
* No production credentials, no production database, no production AI key. Env-var-only config from day one; mock-LLM mode is the default. If the team uses a real AI key, it is their own, with a hard monthly spend cap.
* No production deploy access; the student environment is fully separate (their own Postgres instance — Neon free tier or local — and their own Vercel sandbox under the WA AI Hub team).

**Deliverables:** working pipeline modules \+ tests, golden set \+ evaluation report, brief architecture write-up, and the three progressive demos below.

**Integration contract:** so the work can be merged into Gen Alpha Decoder without the team ever seeing the production repo, deliverables are self-contained modules behind these interfaces (exact types agreed in Sprint 1):

* **checkInputSafety(text)** → **SafetyVerdict** (**safe | refuse | safeguarding**, with reason), and a **\<SafeguardingPanel /\>** component.
* **normaliseSuggestion(text)** and **findLikelyMatches(text, lexicon)**.
* **scoreTermLifecycle(events)** → **AuraStage**, and an **\<AuraBadge /\>** component.
* **pnpm eval** CLI \+ golden-set file format, with the discovery function injected so it can run against production code later.

# **2\. Schedule**

Regular meetings: **Tue, 3 pm WST** (from the week of 6 Oct until 19 Nov). Team email: **alpha-date@wahub.ai**.

| Milestone | Date | Notes |
| :---- | :---- | :---- |
| Kickoff | **Fri 2 Oct, 9 am WST** |  |
| Scope statement approval | **Sat 3 Oct** | Most urgent — this document's §1 is the draft for that approval |
| Sprint 1 \- foundation | Sat 3 Oct → Tue 13 Oct (1.5 wk) | Scaffold bootstrap, stub DB \+ mock-LLM running, integration-contract types agreed, safety gate v1 with safeguarding panel wired in front of discovery, golden-set format and first 50 entries |
| **Demo 1** | **Tue 13 Oct** | Search → safety gate → discovery → stored term, end-to-end |
| Sprint 2 \- major features (heaviest) | Tue 13 Oct → Tue 3 Nov (3 wk) | Full golden set, evaluation CLI \+ report, measured discovery improvement, suggestion normalisation/deduplication, review-queue triage view, tests |
| **Demo 2** | **Tue 3 Nov** | Recorded demo with voice-over uploaded to NotebookLM (Josh away 26 Oct – 13 Nov) |
| Sprint 3 \- lighter, polish | Tue 3 Nov → Tue 17 Nov (2 wk) | Aura lifecycle scoring \+ badge on synthetic events, hardening and edge cases (unicode, emoji, very long input, provider outages), accessibility pass (WCAG 2.2 AA), docs; stretch item if time allows |
| **Demo 3 (final)** | **Tue 17 Nov** | Final feature set |
| Final report \+ codebase submission | **Sat 21 Nov** |  |

**Note:** Josh is away from 26 October to 13 November 2026. There are no online meetings in that period; contact is by email only (slow responses). Urgent matters go to your UNSW supervisor. Plan Sprint 2 so that questions are raised before 26 Oct.

# **3\. joshth/alpha-date scaffold design**

Since this is a **fresh scaffold,** build it as a new, minimal standalone project rather than filtering Gen Alpha Decoder's git history:

* New directory tree (e.g. **scaffold/alpha-date/**) containing:
  * **Current-state copies only** (no **.git** history) of: **app/types.ts** (the **SlangTerm** type), **lib/lexicon-data.ts** (public seed lexicon), **lib/term-cache.ts**, the term-discovery and input-sanitising logic from **app/actions.ts** extracted into **lib/discovery/**, **app/educator/moderation/page.tsx** (as the basis of the triage view, moved to a neutral route), **components/educator/review-buttons.tsx**, and **components/ui/\***. Imports are rewritten to point at local stub modules instead of **lib/db**, **lib/auth**, and the AI providers.
  * **lib/\_stubs/db.ts** — a minimal Drizzle schema/client covering only the tables this slice touches (**terms**, **term\_events**, **term\_feedback**), seeded with synthetic data (generated search-event histories; synthetic IPs such as documentation-range addresses); **no real schema files or migrations copied wholesale**.
  * **lib/\_stubs/auth.ts** — a fake reviewer session sufficient to satisfy gating calls, clearly commented as a student-facing mock, not real auth.
  * **lib/\_stubs/llm.ts** — returns recorded fixture responses by default (**MOCK\_LLM=true**); switches to a real provider only when the team supplies their own key.
  * A trimmed **package.json** with only the dependencies the copied modules need (checked against actual imports).
  * **README.md**: scope statement (§1), setup instructions, explicit list of what is out of scope/inaccessible, the child-safety and privacy rules above, and a short note that this is a derived teaching scaffold, not the production Gen Alpha Decoder codebase.
  * **.env.example** only — never a real **.env**; reinforces the env-var-only credential rule.
* Verify the extraction compiles/type-checks standalone (no dangling imports back into the real Gen Alpha Decoder tree) before handing off.
* Josh pushes this scaffold to **joshth/alpha-date** himself and grants the team access to that repository only.

# **Verification**

1. Run **pnpm install** and **pnpm typecheck** inside the scaffold directory to confirm no imports resolve outside the scaffold (i.e., nothing pulls in real **lib/auth**, **lib/db**, **lib/stripe**, etc.).
2. Run **pnpm dev** with **MOCK\_LLM=true** and no AI key set; confirm a search → discovery → stored term flow and the review-queue view work against the stub DB.
3. Manually review the README, fixtures, and **.env.example** to confirm the student brief contains no real user data, IP addresses, or credentials, that events carry no identity fields, and that the privacy, en-AU, and WCAG 2.2 AA expectations are stated.

Josh reviews the scaffold folder locally before pushing to **joshth/alpha-date**.

# **4\. Contributions to Gen Alpha Decoder™**

The student project delivers several key safety and quality enhancements to Gen Alpha Decoder:

* **Input Safety Gate & Safeguarding:** closes the most important school-readiness gap by screening input before any AI call and directing at-risk users to Australian support services.
* **Measured AI Accuracy:** an evaluation harness and golden set that turn discovery quality into numbers (precision, recall, hallucination rate), so every future prompt or model change can be checked before release.
* **Cleaner Suggestion Pipeline:** normalisation and deduplication that merge variant spellings and surface the most-requested missing terms first, reducing reviewer workload.
* **"Aura" Relevance Lifecycle:** a term-freshness signal that tells parents and educators whether slang is current or outdated — a product differentiator for the website and the future API.
* **Secure Standalone Scaffold:** establishes an isolated repository (**joshth/alpha-date**) using mock authentication, a mock AI provider, and synthetic fixtures, protecting production data, user privacy, and credentials.

# **What Success Looks Like**

The key criteria for successful completion of the project include:

* **Reliable Safety Gate:** 100% of the golden set's self-harm/abuse inputs are routed to the safeguarding panel, no unsafe input reaches the AI model, and the gate fails closed when the moderation service is unavailable.
* **Evaluation Report:** a reproducible **pnpm eval** run reports discovery precision, recall, and hallucination rate on a golden set of 150 or more labelled inputs, with a documented, measured improvement from the team's changes.
* **Effective Deduplication:** variant spellings of the same suggestion collapse into one record with a combined count, covered by tests.
* **Working Aura Scoring:** each term in the synthetic dataset receives a lifecycle stage, with tests for each stage and an accessible badge component.
* **Clean Integration Contract:** delivered modules match the agreed interfaces and type-check standalone, ready to port into Gen Alpha Decoder.
* **Secure Isolated Scaffold:** the team works entirely with synthetic fixtures, stubbed auth, and mock-LLM mode — no production data or credentials.

**Complete Milestones Delivery:** Successful presentation of all three progressive project demos, followed by the submission of the final report and full codebase.
