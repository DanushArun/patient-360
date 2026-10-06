# SAARTHI — Care Readiness & Evidence Copilot

> **SQL decides, AI extracts and phrases, the practitioner stays accountable.** Synthetic data only; engineering
> checks here are not clinical validation.

## Evaluate in 15 minutes

**Offline, no Snowflake account** (needs Python 3 and Node 20+). Run from the repo root. Every command below was run on
4 Oct 2026; outputs are in the results table.

1. `python3 -m venv venv && ./venv/bin/pip install -r requirements.txt && cd frontend && npm ci && npx playwright install chromium && cd ..`
2. `cd frontend && npm test` (unit tests, 381 expected) and `npm run typecheck`
3. `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` (production build, no live access)
4. `npm run test:e2e` (Playwright against a stubbed API, 41 tests; **not live data**)
5. `cd .. && ./venv/bin/python -m pytest -q` (backend and SQL-contract tests, 565 passed / 14 skipped expected)
6. `SAARTHI_SNOWFLAKE_ENABLED=false npm run dev` in `frontend/`, then open `http://127.0.0.1:3000/design-preview/PAT-DC-07`:
   a **recorded fixture snapshot**, labelled as such. Live routes fail closed instead of substituting fixture data.
7. Read, in this order: [`docs/platform/PLATFORM-FINDINGS.md`](docs/platform/PLATFORM-FINDINGS.md) (dated platform findings with query IDs),
   [`docs/testing/FAILURE-AND-FIX-INDEX.md`](docs/testing/FAILURE-AND-FIX-INDEX.md), [`docs/submission/JUDGE-WALKTHROUGH.md`](docs/submission/JUDGE-WALKTHROUGH.md)
   (timed 15-minute path mapped to the rubric, with the "not yet live" list).

**Live path** (your own Snowflake account, synthetic data): paste the ten files in
[`backend/sql/deploy/`](backend/sql/deploy/README.md) into Snowsight in order as ACCOUNTADMIN and read each VERIFY
block, then configure `frontend/` as in Quickstart B below. **This bundle has not been run on a clean account.** Live
results in this repository were observed on other accounts and are reported, not reproducible offline.

### Measured results (absolute counts)

| Measure | Result | Kind and date |
|---|---|---|
| Python tests (`./venv/bin/python -m pytest -q backend/tests tools`) | 565 passed, 14 skipped, 0 failed | offline, re-run 6 Oct 2026 |
| Web unit tests (`cd frontend && npm test`) | 381 passed, 0 failed | offline, re-run 6 Oct 2026 |
| Playwright e2e (`npm run test:e2e`, stubbed API) | 39 of 41 passed; 2 fail: `storyboard-visual` (citation index not found) and `workspace-documents` (expects a raw ISO timestamp the redesigned page no longer prints) | offline, 6 Oct 2026 |
| Typecheck, production build, `check_gate.py --manifest`, deploy-bundle drift check (11 files) | all pass | offline, 4 Oct 2026 |
| QA rounds | 4 independent QA rounds, 5 fix rounds, 4 deploy-plan rounds, 1 code review; [34 recorded failures](docs/testing/FAILURE-AND-FIX-INDEX.md), 3 still open | [`evidence/qa/`](evidence/qa/) |
| SQL rules | 16 rules, 80 fixtures; 28 fixture tests passed live on the earlier account JN89282 (23 Sep); not re-run on the current account | reported |
| Two-pass extraction | 68 assertions verified, 1 page failed closed (`pass_b_invalid`); disagreement path never fired | reported live, OS69400, 3 Oct 2026 |
| Evaluation | 80 questions written (40 dev, 40 held out); **0 scored by a model**; no baseline-RAG comparison. Deterministic Class A/B routing rules alone (no model) decided 15 of the 40 dev questions, 14 correct and 1 Class B over-refused; the other 25 are left to the model fallback and counted as neither right nor wrong. Engineering gate on synthetic questions, not clinical validation | offline, 4 Oct 2026 ([`evidence/qa/FIX-ROUND-6.md`](evidence/qa/FIX-ROUND-6.md)) |

Details: [`evidence/qa/FIX-ROUND-7.md`](evidence/qa/FIX-ROUND-7.md).

Submission to the Snowflake CoCo CLI Hackathon 2026 (GCC Edition), **Problem Statement 04: Patient and Member 360 and
Clinical or Regulatory Document Copilot.** Synthetic data only. No real patient information is loaded into the system.

**What it does.** For a cancer day-care visit, SAARTHI answers with cited evidence which records, authorisations and
checks are **missing, pending or conflicting** before the next scheduled visit, so a family does not travel 1,000+ km
for nothing. Every status, number, date and threshold comparison comes from SQL against a versioned rule, never from a
model. Clinical judgment ("should she proceed?", "is this safe?") stays with the treating practitioner: those questions
are Class A and are refused (NMC Telemedicine Practice Guidelines 2020). Never an opaque prediction, never a confidence
percentage.

**Status in one paragraph (4 Oct 2026).** A local Next.js dashboard (`frontend/`) reads Snowflake through access-checked
procedures on account OS69400 (single operator, `127.0.0.1` only). 12 synthetic patients, 16 SQL rules, 7 Tasks (created,
suspended on purpose), 4 Dynamic Tables, 2 Cortex Search services. Nothing is hosted; a judge cannot run the live
product without their own Snowflake account. Engineering checks on synthetic data are **not clinical validation**.
The authoritative per-component ledger is [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md).

## The seven architecture rules (binding, `AGENTS.md` section 2)

| | Rule |
|---|---|
| **R1** | The LLM never decides. It extracts typed assertions, interprets questions into bounded tool calls and phrases answers from supplied facts. Every status, number, date and threshold comparison comes from SQL against a versioned rule. |
| **R2** | Three clocks: `event_time`, `source_recorded_at`, `ingested_at`. Every answer carries `known_as_of`. |
| **R3** | Missingness is a type, never a NULL (seven states). *Not received* is never *negative*. |
| **R4** | Identity is ABHA-anchored and federated. Never joined on name. Ambiguous matches quarantine and contribute no evidence. |
| **R5** | Scope is enforced server-side before retrieval, in three layers (row access policy on `CURRENT_USER()`, owner's-rights tool procedures with no `patient_id` input, un-RAP'd index returning IDs only). |
| **R6** | Two document corpora (patient / reference), never mixed in one ranked list; physically separate Cortex Search services. |
| **R7** | Safety-critical extraction is never trusted on one pass: two passes, two model families (`llama3.3-70b` and `claude-haiku-4-5`), `temperature: 0`. Disagreement becomes `conflicting` and the gate returns `not_evaluated`. |

## Quickstart

Two independent paths. Neither needs credentials committed to the repo (key files stay outside Git).

**A. Offline, no Snowflake account (what a judge can re-run).** Requires Python 3 and Node 20+.

```sh
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python -m pytest -q                                   # backend + SQL-contract tests
python3 backend/scripts/check_gate.py --manifest                 # deploy-manifest gate
./venv/bin/python -m backend.scripts.build_deploy_bundle --check # Snowsight bundle is not stale
cd frontend && npm ci
npm test && npm run typecheck                                    # unit tests, types
SAARTHI_SNOWFLAKE_ENABLED=false npm run build
npm run test:e2e                                                 # Playwright, stubbed API
SAARTHI_SNOWFLAKE_ENABLED=false npm run dev                      # http://127.0.0.1:3000
```

With live access disabled, open `/design-preview/PAT-DC-07`: a recorded project snapshot (fixture), clearly separate
from the live routes. Live routes fail closed rather than substituting fixture data.

**B. Live, against your own Snowflake account (synthetic data).** Paste the ten files of `backend/sql/deploy/`
(`00_preflight.sql` to `09_verify.sql`) into Snowsight in order as ACCOUNTADMIN, reading each VERIFY block; see
[`backend/sql/deploy/README.md`](backend/sql/deploy/README.md). **This bundle has never been run on a clean account**
(see Limitations). Then in `frontend/`: `cp .env.example .env.local` and set the variable **names** listed there:
`SAARTHI_SNOWFLAKE_ENABLED`, `SNOWFLAKE_ACCOUNT`, `SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT`, `SNOWFLAKE_USER`,
`SNOWFLAKE_PRIVATE_KEY_PATH` (or `SNOWFLAKE_PAT_PATH` with `SNOWFLAKE_AUTHENTICATOR`), `SNOWFLAKE_WAREHOUSE`,
`SAARTHI_AI_WH`, `SAARTHI_ALLOWED_ORIGINS`. The session role is pinned to `SAARTHI_APP` with secondary roles disabled
(`USE SECONDARY ROLES NONE`). Details and cost controls: [`frontend/README.md`](frontend/README.md),
[`docs/platform/PROTOTYPE-COST-CONTROLS.md`](docs/platform/PROTOTYPE-COST-CONTROLS.md).

## What exists in the web app (`frontend/app`)

Five product routes plus a fixture preview:

| Route | Purpose |
|---|---|
| `/` | Day-care census and visit worklist, authorised-patient search |
| `/patient/[id]` | Patient workspace: gate strip, facts, timeline, documents, coverage comparison, ask-the-record |
| `/patient/[id]/documents/[doc]` | Source page viewer with evidence highlight |
| `/review-queue` | Coordinator worklist of open gate failures and review tasks |
| `/navigator/[id]` | Family bring-list and scheme view |
| `/history/[id]` | Review-task and answer history |
| `/design-preview/[id]` | Recorded fixture snapshot (not live data) |

**There is no Judge Console UI.** The eight security probes exist as SQL only
(`backend/sql/procedures/judge/judge_probes.sql`). There is no Streamlit app. `frontend/contracts/` and `frontend/fixtures/` hold the frozen answer contract and recorded fixtures that both the web app and the backend tests validate against.

## Class A / Class B

- **Class A** — clinical judgment (prognosis, dosing, "is this safe?"). Always refused, every role; an `EVIDENCE_PACKET`
  addressed to the named treating practitioner is offered instead. Default when ambiguous.
- **Class B** — record and coverage state ("what do we have?", "what is missing?", "what contradicts what?"). Routed to
  deterministic tools with citations. Coverage by question type is **not yet measured**: 80 eval questions exist in
  `data/eval/` (40 dev, 40 held-out) and none has been scored.

Enforced in three places: `backend/sql/procedures/classify_question.sql`, the agent instructions
(`backend/sql/agent/saarthi_agent.sql`), and web routing (`frontend/lib/question-routing.mjs`, with tests).

## Built, partial, designed-only (absolute counts, 4 Oct 2026)

Definitions and full ledger: [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md). "Built" here means deployed on a
named account and exercised, not reproduced on a clean account.

| State | Components |
|---|---|
| **Built** | 16 SQL rules with 80 fixtures (28 live fixture tests passed on the earlier account JN89282); R7 two-pass extraction (fired live on OS69400: 68 assertions verified, 1 page failed closed); 2 Cortex Search services (R6 split); row access policy on `CURRENT_USER()`; 4 Dynamic Tables; deterministic Class A/B classifier; web routes above; Snowsight deploy bundle (11 generated files, drift check passes) |
| **Partial** | Answer validator (6 checks, procedure exists, **not in the answer path**); Cortex Agent with 8 generic tools and inbound MCP server (verified on JN89282 only, not recorded on OS69400); 7 Tasks (created suspended); semantic view (no verified queries); 12 of 100 patients; 22 synthetic cohort PDFs |
| **Designed-only** | Skills loaded into the agent (4 `SKILL.md` authored, not uploaded, no `skills:` block); outbound MCP action; Judge Console UI; hosted/per-user app; document-derived discordance gate; eval run (scorer exists, no results); reference-scope selector in the UI (disabled) |

Offline test counts re-run on 6 Oct 2026: Python 565 passed / 14 skipped / 0 failed;
web unit 381 passed; Playwright e2e 39 of 41 passed (stubbed API, not live data; the 2 failures are listed above); TypeScript and production build clean.

## Evidence, organised

| Path | What it is |
|---|---|
| `evidence/coco/` | CoCo lifecycle evidence by phase (`planning.yaml`, `development.yaml`, `execution.yaml`, `testing_validation.yaml`), `verification-query-ids.md` (platform findings with query IDs), `sessions-raw.csv`, failure-and-fix pairs. Live evidence is **reported** here; it is not re-runnable offline. |
| `evidence/qa/` | Independent review trail, kept uncurated: `QA-ROUND-1..4`, `FIX-ROUND-1..5`, `FIX-ROUND-7`, `DEPLOY-ROUND-1..4`, `CODE-REVIEW-ROUND-1`, `live-sweep-*.txt` |
| `evidence/clinical/` | Sourced clinical thresholds; `backend/scripts/verify_clinical_proof.py` re-checks them |
| `docs/compliance/DATASET-LICENCES.md` | Dataset and third-party licence inventory |
| `docs/platform/PLATFORM-FINDINGS.md`, `docs/testing/FAILURE-AND-FIX-INDEX.md`, `docs/submission/JUDGE-WALKTHROUGH.md` | Dated platform findings with query IDs, failure index, timed reading path |

Labels: `QUERY_HISTORY` is used for live evidence, `ACCESS_HISTORY` (up to 180 minutes lag) for the written pack.

## Repo map

- `data/generator/`, `data/fixtures/`, `data/generated/`, `data/synthetic_docs/` — synthetic patient and PDF generation (22 cohort PDFs in `data/generated/pdf/cohort/`)
- `data/reference/` — 7 public reference PDFs (PM-JAY manual, FDA trastuzumab label, ICMR, NCG, AIIMS guidelines)
- `data/eval/` — 80 eval questions (`dev.jsonl`, `held_out.jsonl`)
- `backend/sql/` — DDL, procedures, tasks, dynamic tables, search, governance, agent, semantic view, `setup.sql` manifest (58 active steps), and `deploy/` Snowsight bundle
- `backend/skills/` — 4 skill definitions (authored, not loaded)
- `backend/scripts/` — `check_gate.py`, `build_deploy_bundle.py`, `run_rule_fixtures.py`, MCP client, OS69400 deploy helpers
- `backend/eval/harness/score_results.py` — offline scorer; `backend/eval/` otherwise a placeholder
- `backend/tests/` — SQL-contract and pipeline tests, separate from the app in `frontend/`
- `frontend/` — the Next.js app (UI, API routes, tests), plus `contracts/` and `fixtures/`: the frozen answer schema and recorded fixtures shared with the backend
- `docs/architecture/` — specification (`SPEC.md`), contracts (`ARCHITECTURE-HANDOFF.md`), diagrams (`ARCHITECTURE-DIAGRAMS.md`, `diagrams/`, `drawio/`), decision records and design reviews
- `docs/research/` — clinical, legal, platform and patient-reality research behind the design
- `tools/drawio/` — diagram generator; `tools/release_gate.py`
- `AGENTS.md` — binding rules; `IMPLEMENTATION-STATUS.md` — honest ledger

`docs/architecture/FINAL-VALIDATION.md` is a **historical 17 September snapshot**, superseded in part by
`DECISION-household-removal.md`; its competitor comparison is a researcher's reading of public repositories that are not
vendored here and cannot be re-verified from this repo.

## Limitations (stated plainly)

- **Localhost, single operator.** One pinned role (`SAARTHI_APP`), no per-user login, no hosting, no public URL. A judge cannot see the live product without their own Snowflake account and keys.
- **Not yet verified after the latest fixes.** Round-3/4 fixes and the `backend/sql/deploy/` bundle are `unverified-needs-deploy`. The bundle has never been run on a clean account. The cross-patient negative test on `DOC_PAGE` after the Round-4 policy change (finding N4-03) is not recorded.
- **Two Snowflake accounts.** JN89282 (23 Sept: agent, MCP, 28 fixture tests) is historical; OS69400 (1-4 Oct) is current. Figures are labelled per account.
- **Tasks and Search are suspended** to control cost; a task dedupe bug (stage `etag` vs SHA-256 `file_hash`) blocks resuming. Scheduled runs are not demonstrated live.
- **Answer guard not in the answer path.** `ASK_SAARTHI` is a thin agent wrapper; MCP bypasses `validate_answer` too.
- **R7 disagreement path never exercised live.** Both readers agreed on every field that was extracted; one page failed closed for an invalid pass-B response.
- **Co-pilot deferred.** The conversational copilot is limited to the wrapper above; the reference-corpus scope selector is disabled in the UI. The reference corpus (7 documents, 692 pages) is reported loaded and searchable on OS69400 on 3 Oct; Search was suspended afterwards and no cited-answer run against it is recorded for the web app.
- **No eval results.** 80 questions exist; none scored; no baseline-RAG comparison.
- **Scale.** 12 synthetic patients (not 100); 10 of 13 corruption scenarios seeded.
- **Cohort PDFs are generated from the same event snapshot they are checked against.** The 66/66 numeric-value linkage measures linkage, not independent extraction accuracy.
- **No clinical validation.** Three thresholds are practice consensus, labelled as such. Nothing here is clinical decision support.
- **Single Snowflake AI path.** Snowflake Cortex only; there is no local or alternative model provider.
