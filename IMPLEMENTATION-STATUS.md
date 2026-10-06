> **6 October, latest execution checkpoint:** new account `PVYRHHT-XG46956` (locator `WH11571`),
> user `DAKSHA`, AWS_AP_NORTHEAST_1. `claude-opus-5-5` is live on the Snowflake agent.
> Sixteen synthetic PDFs parsed; two-family extraction produced 81 verified assertions and
> 9 unverified findings (6 from these documents, 3 seeded); none were forced to verified.
> The dashboard shows PAT-DC-05's report as Present, 6/6 verified. One uncanned UI question
> completed through the model and SQL citation gate: 4 claims accepted, overall `partial`,
> one candidate omitted. The active scheduled graph's parse, extraction and reconciliation
> ran successfully, but readiness refreshes failed because task sessions used
> `America/Los_Angeles` while SQL treated wall-clock `TIMESTAMP_NTZ` values as UTC.
> All seven task session timezones are pinned to UTC and remain started. The first post-change
> scheduled readiness run completed successfully at 05:54 UTC; its notification child also
> succeeded. Chrome refresh showed a newer 05:51 evidence timestamp, while the page headline
> still says readiness as of 05:24 UTC, so full cohort snapshot freshness is not yet confirmed.
> A manual full cohort refresh hit the 120-second session timeout. The Day
> Care Copilot's first live whole-worklist question failed because its read session dropped
> SQL bind values; this is fixed and verified in Chrome, returning 5 blocked visits and the
> cohort status totals. No resource monitor exists. Reference search is live in the patient
> copilot (6 Oct, XG46956): "Search in: Reference documents" returns verbatim quoted passages
> with publisher, title, version and page; Class A questions are still refused first.
> Prompt-store hashes and agent source match. Local verification: 340 web tests, 15 focused
> Python contract tests, TypeScript pass. This checkpoint supersedes stale account labels below.
>
> **5 October, earlier execution checkpoint:** [full release gates](docs/submission/RELEASE-GATES-2026-10-05.md)
> track 9/20 verified (45%); this is completion tracking, not a judging score.
> Restricted permissions are applied. Live authorized/foreign claim and consent-withdrawal
> probes passed. Answer, practitioner packet and retried action each have one persisted row.
> Guarded ASK works on NY64016 with bounded SQL recovery. Native agent remains trial-blocked.
> Public hosting is a credential-free recorded preview; live backend credentials remain absent.
> Latest checks: 684 Python passed, 14 skipped, 36 subtests; 291 web; 41 distinct fixture E2E.
> Eight recovery checks passed, seven overlapping the prior 40-test suite.
> Independent evaluation v2: 48 development/48 held-out questions, 8 PDFs/patients,
> disjoint renderers; 8 held-out missing/conflict cases. Final system scores are not measured.
> The SQL-ID freezer, pre-AI loader and metering collector are built; execution is separate.
> RULE citations passed the live app-role validator; receipt history and UI recovery passed.
> Seven VQR definitions ran as direct SQL; native skill invocation remains unverified.
> Finalized deck and timed script are in docs/submission. Final evaluation, full concurrent
> isolation, new-ingest golden loop, observed economics and video remain open. Portal untouched.
> Bounded SQL context is implemented with one frozen clock and separate corpora.
> Private helpers compiled; integrated context/inference runtime still needs funded execution.
> Backend health now requires a restricted SQL receipt and release identity. Local 503/no-store
> behavior passed; hosted 200/readiness is unverified. Five reference origins byte-matched.
> This checkpoint overrides conflicting current-state statements in the dated history below.

# SAARTHI — Implementation Status

**Latest checkpoint, superseded 6 October 2026:** the active execution account and current
verification are summarized above. **Historical checkpoint, 4 October 2026, 21:13 IST:** the user confirmed submission account
`KGTPGHJ-YJ28449` (`NY64016`). Earlier account labels below describe their dated runs,
not the current submission target. The answer validator was updated and exercised on
NY64016; the web guard and SQL-derived refusal clock pass local tests. Current local
verification: 418 Python tests, 267 web tests, TypeScript and production build pass.
The agent JSON instruction is not deployed; full web Q&A, document entailment,
independent evaluation and hosting remain unverified. See
[the bounded runtime evidence](evidence/qa/ANSWER-BOUNDARY-2026-10-04.md).
This checkpoint overrides conflicting current-account and validator-wiring statements
in the historical reconciliation below, without transferring its old metrics.

**Reconciled 4 October 2026 (FIX-ROUND-5).** This file has three parts: (A) the current state, keyed by Snowflake
account; (B) the dated log of 1-4 Oct checkpoints (OS69400, current account); (C) the 20-23 Sept snapshot on JN89282,
retained as **historical** and labelled per row. Where (A) and (C) differ, (A) wins. Live results below are
**reported** from the dated entries and the evidence files; they cannot be re-run offline. `AGENTS.md` section 4 mandates
this file; a claim not demonstrable from the repo is a defect.

| Status | Meaning (changed 4 Oct: the old definition required clean-account reproduction, which has never been recorded) |
|---|---|
| **built** | Deployed on a named account and exercised (account and date stated). `reproduced-clean-account: no` for every component |
| **partial** | Works for a bounded path; named limitation stated |
| **designed-only** | Specified, not built. Not claimed as working anywhere |
| **unverified-needs-deploy** | Present in the working tree; not run on Snowflake since the last edit |
| **refused** | Deliberately not built (section 9) |

Accounts: **OS69400** (org-qualified `OHCXVXM-OS69400`, locator `JR18576`) is the **current** account: the deploy
scripts, web default allow-list and the 4 Oct live identity query (query ID `01c77fc2-0004-0cda-0001-fcae00112ae2`, in
`evidence/coco/snowflake-new-account-rca.md`) target it. `KGTPGHJ-YJ28449` (locator `NY64016`) was the earlier 3 Oct
migration target and still appears in `docs/superpowers/plans/2026-10-04-submission-account-inspection.md` and the RCA;
the repo does not record a deployment of the current build there. **JN89282** is **historical** (16-23 Sept: agent, MCP,
28 fixture tests); its counts are not current figures. Nothing from JN89282 is recorded as redeployed on OS69400 unless
stated. Which account holds the submission build must be confirmed by the team (gap 13).

## A. Historical state by component (4 Oct 2026; current 6 Oct delta is above)

| Component | Status | Account / date | Notes and corrected wording |
|---|---|---|---|
| Web dashboard (`web/`, 7 page routes incl. fixture preview, 8 API routes) | **built** (local) | OS69400, 1-4 Oct | Localhost `127.0.0.1`, single operator, role `SAARTHI_APP`, secondary roles off. No hosting, no per-user login. 257 unit, 40 e2e (stubbed API) pass offline on 4 Oct |
| Judge Console | **designed-only** (UI) | - | **SQL probes only** (`backend/sql/procedures/judge/judge_probes.sql`); no UI exists (C-1, C-8) |
| Streamlit-in-Snowflake app | **refused/removed** | - | Pages removed; `frontend/` keeps contracts, pure helpers, fixtures and tests only. `frontend/pages/` is empty (C-2) |
| 12 synthetic patients | **partial** | OS69400, 3 Oct | PAT-DEEP-0001 + PAT-DC-01..11. 12 of a planned 100 (C-13) |
| Documents | **partial** | OS69400, 3 Oct | 28 active documents (3 Oct); 22 single-page cohort PDFs generated from the same event snapshot they are checked against |
| 16 SQL rules | **built** | 28 live fixture tests on JN89282 (23 Sept); OS69400: gates computed live, `CLIN-PLT-001` etc. | Fixture harness not re-run on OS69400 |
| R7 two-pass extraction (R7) | **built** | OS69400, 3 Oct | Fired live: 68 assertions all `verified`, 1 page (PAT-DC-08 pathology) failed closed (`pass_b_invalid`). **The disagreement path (`conflicting` -> `not_evaluated`) has not been exercised live**: both readers agreed on every extracted field (C-7) |
| Linker | **built** | OS69400, 3 Oct | 66 of 66 numeric values link to exactly one structured event. Documents are generated from the same event snapshot: this measures linkage, not independent extraction accuracy (C-20) |
| Answer validator (6 checks, `validate_answer.sql`) | **partial** | JN89282 only | Procedure built; **not called by `ASK_SAARTHI` or the MCP path** (Round 6 reviewed wiring and declined: the agent is not constrained to emit the frozen claims schema the validator needs, so a call would either always fail closed or need a new claim-extraction step outside SPEC s7); `web/README.md` records the guard as deferred. Check 4 (`AI_FILTER`) only tested structurally (C-6) |
| Copilot record tools (8, deterministic) | **built**; live on NY64016, 6 Oct | 6 Oct (local app, PAT-DC-04) | `web/lib/copilot-tools.mjs`: after the Class A check, a Class B question that names readiness, labs, documents, coverage, timeline, conflicts, tasks or the visit is answered from the same governed reads the screen uses, as an inline card (summary, rows with state word and icon, up to 2 actions, citations recorded in answer history). No model writes any of it. Live: 5 tool questions answered (readiness twice, labs, documents, coverage); the 2 timed took 11.5 s and 13.1 s, one governed session each (bind, consent, classification, read, history). A Class A question in the same runs was still refused. Suggested questions are tested against `classify_question.sql` patterns so none falls to the unavailable LLM fallback. Unmatched questions still go to `ASK_SAARTHI` |
| Live copilot (floating dock, on-screen orchestration) | **built**; local app on XG46956, 6 Oct | 6 Oct (headless Chromium, live data, synthetic speech input) | `web/lib/copilot-intent.mjs` plans a spoken or typed request into a closed set of screen steps (choose patient, go to page, open section, find item, add to chat, ask, mark cited items); `web/lib/copilot-run.mjs` runs them with pause, resume, stop and receipts written only on completion; `web/components/copilot/copilot-live*.tsx` carry them out with the existing router, section state and governed `/api/ask` and `/api/copilot/cohort` paths. No model plans or decides anything: planning is deterministic pattern matching. A spoken name only highlights the patient; a person's click opens the record. Manual clicks, keys or scrolling pause any step that would move the view. Browser checks, 6 Oct: voice request → confirm → record opened → Overview → answered (instruction asked as "What is missing in the record?") → 2 cited checks marked; manual click paused a 4-step run and Resume finished it; a missing item ("echo report") failed honestly; Return to previous view restored Documents; turning the copilot off mid-run cancelled it and cleared marks. **Not verified:** a real microphone (speech input was injected), Safari/Firefox, dark appearance. The cohort step failed live with `no_patient_bound` from `/api/copilot/cohort` (the same endpoint fails without the live layer) |
| Cortex Agent (8 generic tools, no `patient_id` input) | **partial** | JN89282, 23 Sept | Not recorded on OS69400. `ASK_SAARTHI` is a thin `DATA_AGENT_RUN` wrapper |
| MCP server | **partial** | JN89282, 23 Sept (query ID `01c74481-0003-92e6-0001-fca600116122`) | Inbound server over the agent verified there. No outbound action (ticket/notification send). MCP calls are not passed through `validate_answer` (C-19) |
| Semantic view | **partial**; Round-6 version **unverified-needs-deploy** | JN89282 (old 2-entity view) | Working tree (4 Oct, Round 6): widened to 6 tables (patient, encounter, readiness, review_issue, authorization, scheme_eligibility) with **7 verified queries** (SPEC s8 lists 6; Class B only) and `AI_QUESTION_CATEGORIZATION`. Offline contract test checks every VQR column is defined in the view (`backend/tests/test_semantic_verified_queries.py`). **Not run on Snowflake:** the `AI_VERIFIED_QUERIES` clause syntax and the physical-table form of the VQR SQL are unverified, no VQR has been validated against its natural-language question, and the agent does not consult the view (no Cortex Analyst tool over patient data, AGENTS.md 3.5) (C-12) |
| Skills (4 `SKILL.md`) | **partial**; loading **unverified-needs-deploy** | offline, 4 Oct (Round 6) | Four definitions authored. `backend/skills/upload_skills.sql` now generated (COPY INTO, one per skill; in `setup.sql` step 19 and bundle step 04), and the agent spec has a `skills:` block pointing at the stage folders: **none of this has run on Snowflake**, and whether the agent spec accepts the block is unknown. Reuse proof is offline only: `backend/skills/reuse-tests/evidence_reconciliation/` runs a deterministic **reference implementation** of the skill contract on a second synthetic schema (one mapping and a supersession chain; two ambiguities refused as `not_evaluated`). It is not an LLM executing the skill. `TASK_SAARTHI_ORCHESTRATOR` chains parse, chunk, extract, reconcile and refresh procedures; it does not orchestrate skills (C-3) |
| Tasks (7) | **partial** | OS69400, 3 Oct | Created, **suspended on purpose** (cost). The etag-vs-`file_hash` dedupe bug is fixed in the working tree (Round 6: both cursors key on `DOCUMENT.source_path`, etag only as a legacy fallback; `parse_documents_proc` added to bundle step 04): **unverified-needs-deploy**, and `file_hash` on rows the task inserts still holds the stage etag, not a SHA-256. Chain exercised manually. Scheduled runs not demonstrated (C-11, gap 17) |
| Dynamic Tables (4) | **built** | OS69400, 3 Oct | Resumed and refreshed (`DT_REVIEW_QUEUE` 0 -> 17 rows) at that checkpoint. AI steps correctly live in Tasks (platform fact 9) |
| Cortex Search x2 (R6) | **built** | XG46956, 6 Oct | `REFERENCE_DOC_SEARCH` 628 rows and `PATIENT_DOC_SEARCH` 24 rows, both `ACTIVE`. Reference scope is answered from the reference service alone (`web/lib/patient.ts` `answerFromReferences`, before the record tools and patient gateway); attached patient items are dropped for reference questions |
| Reference corpus | **built**; one document **unreadable** | XG46956, 6 Oct | 7 documents: 6 active (628 chunks), the PM-JAY HBP 2.2 manual loaded as `unreadable` (0 text pages). Cited web-app answers recorded in Chrome on 6 Oct for 3 questions (Herceptin LVEF monitoring, Herceptin warnings, ICMR HbA1c), 3-4 quoted passages each. Passages are chosen by a fixed term-overlap rule over Cortex Search's ranking and quoted verbatim (`web/lib/reference-answer.mjs`); no model writes them. No effective date is recorded for any document, and the UI says so. The question classifier refuses some document-content questions as Class A (e.g. "Which section of the trastuzumab label covers cardiomyopathy?"); over-refusal, not leakage |
| Row access policy on `CURRENT_USER()` | **built**; Round-4 version **unverified-needs-deploy** | F3 verified (query IDs); OS69400 patient-scope check 3 Oct | N4-03 (does the inner `doc_id` bind to `DOC_PAGE`?) unresolved; **no recorded cross-patient negative test on `DOC_PAGE` for the current policy** |
| Masking policies (2) | **built** | JN89282 only | Not recorded on OS69400 |
| Eval harness (`backend/eval/`) | **partial** | offline, 4 Oct | `harness/score_results.py` (scorer) plus `harness/deterministic_routing_baseline.py`, a rules-only Class A/B baseline whose patterns are read from `classify_question.sql`. **Measured on `data/eval/dev.jsonl` (40 synthetic questions; engineering gate, not clinical validation; AI_CLASSIFY fallback not run):** 4 Oct rules: decided 15, 14 correct, 1 Class B over-refused (DEV-018); 25 left for the LLM fallback (3 Class A, 22 Class B); of 9 Class A, 6 refused by rules and none answered as B. **6 Oct, after widening the judgment and record scans** (working tree; **unverified-needs-deploy**): dev decided 34, 33 correct, still only DEV-018 over-refused, 6 residue; 8 of 9 Class A refused, none answered as B. Held-out, rules only, run once after tuning on dev: Class B answered by rules 3 to 12 of 33, Class A answered as B 0 of 7 before and after. On NY64016 `AI_CLASSIFY` returns 399504, so residue fails closed to Class A: before the change 22 of 31 dev Class B questions were refused live. Results in `backend/eval/results/`. The end-to-end answer eval and any baseline-RAG comparison have **not** been run (C-4) |
| Class A/B classifier | **built** (source) | JN89282 live; OS69400 web routing tests offline | Class B question-type coverage is not measured (C-5) |
| Deploy bundle (`backend/sql/deploy/00-09`) | **unverified-needs-deploy** | - | Generated, drift check passes (11 files; Round 6 added the semantic view in step 02 inside an exception handler, and `parse_documents_proc` plus the skills upload in step 04); never run on a clean account (C-15) |
| `setup.sql` manifest | **built** (manifest) | JN89282 run end-to-end at 55 steps | Now 59 active steps (`check_gate.py --manifest` PASS; Round 6 enabled the skills upload); contains `[NOT BUILT]` lines; clean-account reproduction unproven |
| Competitor comparisons | **partial** | - | Competitor source is not vendored in this repo; claims are a researcher's reading, historical (C-16, C-17). See `docs/DECK-OUTLINE.md` |
| 13 corruption scenarios | **partial** | - | 10 seeded and tested live on JN89282/OS69400; 3 handled by design, **not tested** (C-14) |
| Model-risk register | **designed-only** | - | Not present in the repo |
| CoCo lifecycle evidence | **built** | - | 4 YAML manifests (planning `complete`; development, execution, testing `in_progress` per their own `status:` fields); `evidence/coco/README.md` phase table corrected 4 Oct; work after 22 Sept is not CoCo evidence; session provenance to be reconfirmed by the team (gap 20) |

**Not claimed:** hospital readiness, clinical validation, population scale, hosting, multi-surface (Snowsight Cloud
Agents / Slackbot) evidence.

## B. Dated log (newest first; OS69400 unless stated)

**4 October 2026 — Round 6 offline build (working tree, `unverified-needs-deploy`; details in `evidence/qa/FIX-ROUND-6.md`):**
semantic view widened with 7 verified queries and a column-contract test; skills upload generated and added to `setup.sql`, the
agent spec (`skills:` block) and bundle step 04, with an offline second-schema reuse test; task dedupe on `source_path`
documented, tested and bundled; deterministic Class A/B routing baseline measured on the 40 dev questions (counts in the
eval row above); `evidence/coco/README.md` corrected. The answer validator was **not** wired in. Nothing here ran on Snowflake.

**4 October 2026 — PR #14 integration, local verification only:** the document
improvement branch is reconciled with PR #15. The combined task sources retain
stage-path deduplication, directory refresh, stream consumption, task user identity
and once-only extraction stamping alongside independent bounded model reads,
heading routing and exact evidence checks. Invalid patient parses are recorded
as unreadable with their stage path. Both branches’ historical checkpoints below
are retained; their live results do not validate this combined SQL or the
LangExtract runner. Snowflake compilation, live runner validation and the
remaining release gates still require separate work.

**3 October 2026 — cohort documents, reference corpus and Search live, OS69400:** 22
single-page synthetic reports (one lab panel + one histopathology per `PAT-DC-*` patient,
rendered by `data/generator/cohort_documents.py` from an exported `CLINICAL_EVENT` snapshot)
went through parse → two-family extraction. **68 assertions, all verified**; 6 diagnosis-only
pathology pages yielded 0 (no diagnosis concept in the ontology); **PAT-DC-08 pathology failed
closed** (`pass_b_invalid` from `claude-haiku-4-5`, no value asserted, page kept). Every
patient now has documents (28 active). Linker: **66 of 66** verified numeric values link to
exactly one structured event. Reference corpus loaded: **7 documents, 692 pages, 692 chunks**
(the 431-page AIIMS manual in 40-page `page_filter` batches, because the warehouse caps a
statement at 120 s). Both Search services resumed and `ACTIVE` (692 reference / 26 patient
rows); verified as `SAARTHI_APP`: PM-JAY pre-authorisation clauses returned with page indexes,
and a PAT-DC-04-bound search for another patient's specimen returned only PAT-DC-04 pages. The 4
Dynamic Tables resumed and refreshed (`DT_REVIEW_QUEUE` 0 → 17 rows). **The 7 Tasks stay
suspended on purpose:** `parse_documents_proc` deduplicates on `DIRECTORY().etag`, but every
document here stores a SHA-256 in `file_hash`, so resuming would re-parse all ~29 staged files
and create paid duplicates. Not tested: a Class A question against the new reference corpus
(refusal is upstream in the classifier, unchanged).

**4 October 2026 — QA Round 3 fixes (working tree, `unverified-needs-deploy`):** timeline and labs
facts share one `value_state` rule (a recorded final event with a label is `present`, never
`not_received`); the UI offered no reference scope at that checkpoint (enabled 6 Oct, see the table); the document manifest has a documented
generator step; `DOC-SURG-NOTE-01` (PAT-DEEP-0001) gets a synthetic source page, so its three
seeded assertions can now be read by the two-pass pipeline (they stay `unverified` until it runs;
PAT-DEEP-0001 also has the live CBC document). **Designed-only, not claimed:** the
`discordant_across_specimens` `EVIDENCE_LINK` rows written by `reconcile_evidence_proc` are never
read by any gate. `DOC-DISC-001` counts distinct `specimen_id` on `CLINICAL_EVENT`, and the generated
documents carry no `accession_id`, so document-derived discordance is **designed-only**.
Detail: `evidence/qa/FIX-ROUND-3.md`.

**3 October 2026 — two documents extracted, provenance and letter conflict live, OS69400:**
the credit quota was raised, so two single-page synthetic PDFs went through parse → two-family
extraction (`llama3.3-70b` + `claude-haiku-4-5`). **Tata Memorial CBC (PAT-DEEP-0001): 3/3
verified** (WBC 6,000, neutrophils 35.0%, platelets 2,60,604). **PM-JAY letter (PAT-DC-07): 2/2
verified** (`Approved`, valid until 2026-11-30). Both readers agreed on every field, so this
shows nothing about disagreement handling. The first parse was cancelled by the 120 s statement
timeout (no rows written) and succeeded on one retry with a 900 s session limit.
`reconcile_evidence_proc` now writes `EVIDENCE_LINK` `supports` rows only when exactly one
same-patient, same-concept, same-day event carries the identical number: 3 links, platelets to
the original 260,604 rather than the amended 245,100; the first live call hit the timeout, the
second completed with no duplicates. The ontology gained `AUTH_STATUS` / `AUTH_VALID_UNTIL`
(extraction drops anything outside the ontology, so letters previously yielded nothing).
Coverage comparison for PAT-DC-07 now shows table `pending`, letter `Approved` with exact
spans, gate `conflicting`; a cutoff before ingestion hides the letter. The patient header now
uses the same visit as the gates (it went blank the day after a visit). Still open: the other 11
patients have no documents except DC-07's letter; reference corpus not loaded.

**3 October 2026 — workspace reads built, OS69400, partial:** the patient workspace's
Documents, Facts and Coverage-comparison reads had **no server route**: every
`/api/patient/[id]/workspace` call returned 404, and the browser suites passed only because
`storyboard-api.ts` stubs that endpoint. Now built: `documents`, `facts` (6 domains) and
`coverage_comparison` views in `GET_WEB_PATIENT_DATA`, plus the route. Each was exercised live
as `SAARTHI_APP` with secondary roles off, through the running route on PAT-DEEP-0001 and
PAT-DC-09: cutoff echo, bad-cutoff rejection, and the financial-consent refusal (PAT-DEEP-0001
lacks it; the route no longer purges patient state for that case). No browser or E2E test
covers these reads against live data yet. Observed limits, not fixed: only PAT-DEEP-0001 has
documents (4 active) — the other 11 patients have none, and the repo holds no synthetic
documents for them; `EVIDENCE_LINK` is empty, so lab facts show no source documents; no
`authorization_letter` documents exist, so Coverage comparison shows no letters; several
PAT-DEEP-0001 labs have no ontology concept. All 7 Tasks were **created suspended** (none
existed). The 4 Dynamic Tables and both Search services remain **suspended**;
`REFERENCE_DOC_SEARCH` holds 0 rows (the 159-chunk figure below is from JN89282). Nothing was
resumed: `SAARTHI_PROTOTYPE_LIMIT` had 1.57 of 2.00 credits used, suspends at 90%, and never
resets.

**3 October 2026 — orphaned lab concepts fixed:** four PAT-DEEP-0001 lab events (the amended
platelet count, two haemoglobins, one creatinine) carried concept UUIDs hard-coded from
JN89282, so on OS69400 they matched no ontology row and no rule could see them.
`load_synthetic.sql` now resolves each by `canonical_name` and repairs existing rows. Applied
live (4 rows updated); after a single `DT_HARMONIZED_EVENTS` refresh and a readiness recompute,
`CLIN-PLT-001` cites the amended count and no outcome changed. The Facts "labs" domain no longer
lists diagnoses, histopathology or medications. `EVIDENCE_LINK` has **no writer anywhere in the
repo**: the one truthful candidate link is pathology, and no lab document has been extracted
(the CBC page has 0 assertions), so lab source links stay empty without paid extraction.

**3 October 2026 — bounded runner candidate, not live verified:** a private Node/Python
test runner now connects scoped patient reads, local key-pair JWT creation,
two direct model reads and two real LangExtract reads for one existing synthetic
page. It checks access and source version before each call, plans the four-call
estimated cost and writes no clinical assertions. Local mocked tests pass;
**zero live Cortex calls have run and no accuracy improvement is claimed**.
The reported second-laptop role fix is recorded in the release gates. A fresh
Snowsight balance and exclusive warehouse use are required for the approved
$10 continued-work approval; each invocation still reserves at most $1, and
billing remains an estimate, not an account-wide hard cap. The user also
approved a 3-credit warehouse monitor. A one-property, fail-closed migration
script is prepared; the local secure connection failed OCSP validation and
stopped at its 45-second deadline before any live metadata read, so **the
monitor has not been changed here**. The local
runner now requires the 3-credit setting before it will run.

**3 October 2026 — default-role change approved but not applied:** the attempted
change could not authenticate because the missing-OCSP certificate failure
returned. The connection deadline stopped the run before SQL. Last verified
default is still `ACCOUNTADMIN`; no model calls or warehouse resume occurred.
The user's approval and failed attempt are recorded in the release-gates log.

**3 October 2026 — connection retry passed, role gate remains:** TLS/OCSP and
metadata checks now succeed. The warehouse remains suspended; `SITAR` defaults
to `ACCOUNTADMIN`, so the bounded Cortex REST test stopped before source reads
or inference. No role/grant changes or paid model calls occurred. Changing the
default role awaits approval. [Recorded checks](docs/DOCUMENT-IMPROVEMENT-RELEASE-GATES.md).

**3 October 2026 — approved live preflight blocked:** the user approved a maximum
$1 for one synthetic-page/four-call compatibility test. Authentication failed
before any SQL or inference: first certificate-chain trust, then missing OCSP
AuthorityInfoAccess with the system trust store. Certificate checks remain on;
no warehouse was resumed and no paid model call ran. This is not a live
compatibility result. Local checks: **51 targeted Python tests, 265 frontend
unit/render tests, TypeScript and 9 manifest/preamble gates passed**; source tests
do not prove SQL compilation. Details: [release gates](docs/DOCUMENT-IMPROVEMENT-RELEASE-GATES.md).

**3 October 2026 — second local document checkpoint, partial:** candidate SQL
updates add conservative heading routing, remove filename-based source-quality
claims, make batch model reads independent, tighten both extraction paths, and
carry verified patient assertion IDs/exact spans from Search into stricter answer
validation. They are **not deployed or Snowflake-compiled**. Local Python now also
evaluates supplied parse output, compares saved A/B/C predictions and tests an
opt-in Snowflake-only HTTP transport with fake responses. No credentials or paid
services were used. Clinical approval, persistent SQL specimen links, shared
extraction envelopes, reference-clause validation, actual orchestration/E2E,
live cost/accuracy and hosting remain open. See [release gates and cost proposal](docs/DOCUMENT-IMPROVEMENT-RELEASE-GATES.md).

**3 October 2026 — offline extraction trial, partial:** LangExtract 1.7.0 ran
locally with injected fake Cortex responses and network-blocked tests. **26/26
targeted Python tests, 265/265 frontend unit/render tests, and TypeScript passed.**
The four existing synthetic PDFs contained all ten expected field lines and
matching context anchors. That is a text baseline, not model accuracy or OCR
validation. Exact evidence highlighting now uses Unicode code-point offsets;
whole-page evidence is not presented as an exact highlighted excerpt. Latest
`main` was incorporated at `d5c5f8c`, and the fix preserves its document-viewer
structure and scoped reads. The first broad frontend run failed because local
dependencies lagged the pulled lockfile; syncing that lockfile resolved the
missing `ajv` / Playwright dependencies without changing dependency manifests.
No database queries, paid model calls, SQL changes, deployments, or full E2E
tests were performed for this checkpoint. Live Cortex transport, accuracy
comparison, batch-path integration, ANC source-field review, and hosting remain
open. See [the trial instructions and limits](backend/extraction/README.md).

**1 October 2026 update — OS69400, partial E2E:** the dashboard and review queue
now use access-checked owner procedures with `SAARTHI_APP`; the local admin override
is off. One approved task passed acknowledgement, same-owner reassignment,
resolution and retry/read-back checks without changing its 12 clinical results.
One existing one-page PDF passed parsing, independent two-family extraction,
patient Search, exact source-text retrieval and cross-patient denial. Both Search
services were suspended after testing. These are bounded engineering checks,
not a completed document-to-rule-to-validated-answer workflow or clinical validation.
Answer history, prepared practitioner packets and one-patient readiness saving
are implemented but still need complete UI runtime verification. Reference data,
different-owner reassignment, permission/session/language regressions, clean-account
patch deployment and the answer guard remain open. Hosting/per-user login are
deferred; Judge Console is excluded from this frontend scope. **49 web tests,
TypeScript and the production build passed.** See the latest checkpoint in
[the test and cost log](docs/PROTOTYPE-COST-CONTROLS.md) and [web setup](web/README.md).
The dated observations below describe earlier checkpoints, not the current account.

**30 September source reconciliation:** the current tested development baseline
and account-access blockers are in [WORKSPACE-BASELINE](docs/WORKSPACE-BASELINE-2026-09-30.md).
The dated deployment counts below are retained as historical observations, not
current clean-account proof. Five of five read probes failed with `002003` under
the configured `SAARTHI_APP` role. New source consent/release corrections are not deployed.

## C. Historical snapshot, 20-23 September 2026 (JN89282) — superseded by section A

Everything below this heading was written against **JN89282** between 20 and 23 September. Counts (35 tables, 55 deploy
steps, 6 tasks "live", 159 reference chunks, "4 of 6 screens wired to fixtures") describe that account on those dates and
**are not current figures**. Rows that say "built + live" mean "built and live on JN89282 on that date". "R7 has not yet
fired live" was true then and is superseded by the 3 Oct entry in part B (68 assertions). The 6-screen list in section 5
is superseded by the real routes in part A.

**23 September audit notice:** Most inventory and counts below are a 20 September snapshot.
They do not describe the current live database or Next.js page. Do not cite their old
`designed-only` labels as current status. The current observed paths, failures, and untested
release gates are in [the clinician completeness audit](docs/COMPLETENESS-MAP.md).
The live audit proved one synthetic-patient load, one Class B answer, one task creation,
one language switch and browser-session restoration. It did not prove the document-to-answer
pipeline, six specified workflows, access controls, or hospital readiness.

`AGENTS.md` §4 mandates this file. Judges spend 5–22 October alone with this repository, and Solution Completeness is 30% of the score. **A claim in the README that is not demonstrable here is a defect.**

| Status | Meaning |
|---|---|
| **built** | (historical definition, replaced by the table at the top) |
| **partial** | Works for the demo path; named limitations below |
| **designed-only** | Specified in the architecture, not built. **Not claimed anywhere as working.** |
| **verified** | Empirically tested against the live account, query ID recorded |
| **refused** | Deliberately not built. Reason stated. |

**Historical header (23 Sept 2026, JN89282):** v2 schema live on JN89282; 55 active deploy steps then (58 now); MCP inbound path verified.

---

## Summary as of 23 Sept 2026

| Phase | State |
|---|---|
| Research | **complete** — 26 files, 19 real reports studied, 10 platform behaviours verified |
| Architecture | **complete** — 7 specification documents, 15 diagrams in 2 renderings, 0 unresolved contradictions |
| Build | **live vertical slice on JN89282** — 35 tables, 4 dynamic tables, 6 tasks, 18 procedures, 2 Cortex Search services, 1 semantic view, 1 agent, 1 MCP server (external round trip verified). `check_gate.py --manifest` PASS at 55 active deploy steps. 28/28 rule-fixture tests pass. 4 of 6 Streamlit screens wired to fixtures (Navigator + Judge Console still designed-only). |

**The vertical slice is demonstrable end-to-end.** Remaining gaps are named in §5 and `REMAINING-WORK.md` — 88 of 100 patients (need `ledger.py` parameterisation), FHIR bundles per patient (blocked on same), 2 UI screens (Navigator + Judge Console), and the frontend→live-backend wiring pass.

### Day-1 scaffold — the scaffold is now built out

Kept for provenance. Every row below has moved past its Day-1 state.

| Artifact | Status |
|---|---|
| `frontend/contracts/answer_schema.json` + `error_shape.json` + `tool_signatures.yaml` | **built** — Contract 3 and Contract 2, verified by a passing check |
| `frontend/fixtures/` — 3 answer fixtures, 3 page fixtures | **built** — validate against the schema; char offsets generated from the page text |
| `backend/scripts/check_gate.py` — 5 mechanical checks | **built** — verified to catch injected violations, not only to pass |
| `backend/scripts/deploy.sh` — manifest-driven deploy | **built + live** — 55 active steps, run against JN89282 end-to-end |
| `backend/sql/setup.sql` — 21-step manifest | **built + live** — every mainline step uncommented; MCP + AUTHORIZATION consolidation landed 23 Sept |
| `backend/sql/procedures/tools/_preamble.sql` | **built** — referenced by all 8 tool procedures; verified via `ASK_SAARTHI` end-to-end |
| `backend/sql/prompts/` | **built** — `pass_a_lab` and `pass_b_verify` verbatim from the spec; type-specific prompts wired through `extract_assertions_proc` |
| `backend/skills/` — 4 `SKILL.md` | **built** — 60+ line bodies, uploaded via `SKILLS` stage |
| `backend/tests/TEST-MANIFEST.md` — 36+ named tests | **partial** — 28 live rule-fixture tests pass; remaining tests still named-only |
| Everything below this section | **live on JN89282** — see §2–§8 for per-object build state |

**Prompts are through the extractor now and driving real rule outcomes.** The one live gap the Day-1 disclaimer named — untested prompts scoring production numbers — is closed. Remaining risk is scale (single patient today), not scaffold status.

---

## 1. Platform behaviour — verified

Query IDs in `evidence/coco/verification-query-ids.md`. These are findings, not features, and they decided the architecture.

| ID | Finding | Status |
|---|---|---|
| F1 | `AGENT_RUN(VARCHAR)`, `DATA_AGENT_RUN` exist → container runtime optional | **verified** |
| F2 | Row access policies filter strictly, including `ACCOUNTADMIN` | **verified** |
| **F3** | **`CURRENT_USER()` survives owner's-rights elevation; `CURRENT_ROLE()` does not** | **verified — architecture-deciding** |
| F4 | Cortex Search cannot be created over a RAP-protected table | **verified** |
| **F5** | **Cortex Search ignores row access policies — returned another patient's text** | **verified** |
| F6 | `@eq` attribute filter works | **verified** |
| **F7** | **Secondary roles defeat a `USAGE`-based control** | **verified** |
| F8 | `AI_FILTER` text form takes one argument | **verified** |
| F9 | Stages used by AI functions must be `SNOWFLAKE_SSE` | **verified** |
| F10 | Budget: $386.10 of $399.02 remaining on the primary account | **verified** |
| **A1** | **The agent derives `patient_id` from question text and injects the filter itself** | **verified — architecture-deciding** |

| ID | Unverified | Owner | Blocking? |
|---|---|---|---|
| U1 | `AI_PARSE_DOCUMENT` per-page cost | Stream C, Day 1 | Blocks Tier 2 corpus commitment |
| U2 | `CURRENT_USER()` inside deployed Streamlit container runtime | Stream B, Day 1 | Fallback exists (F3, F7) |
| U3 | `CREATE STREAMLIT … COMPUTE_POOL` on trial | Stream B, Day 1 | Warehouse runtime works regardless (F1) |

---

## 2. Data model — 34 built + populated, 7 designed-only

Specified in `SPEC.md` §2. **All 34 `[B]`-marked tables are live on JN89282** as of 23 Sept, with `SCHEME_REGISTRY` additionally deployed (35 tables total; `PRE_AUTHORIZATION` retired 23 Sept — columns merged into `CORE.AUTHORIZATION`).

| Schema | Tables | Status |
|---|---|---|
| `GOVERNANCE` (8) | ORGANIZATION · FACILITY · DEPARTMENT · PRACTITIONER · CARE_TEAM · **PATIENT_BINDING** · CONSENT · SECURITY_EVENT | **built + populated** |
| `CORE` (8) | PATIENT · ID_MAP · REFERRAL · ENCOUNTER · CLINICAL_EVENT · TREATMENT_PLAN · COVERAGE · AUTHORIZATION | **built + populated** |
| `DOCUMENTS` (4) | DOCUMENT · DOC_PAGE · DOC_CHUNK · RAW_FHIR_BUNDLE | **built + populated** (RAW_FHIR_BUNDLE empty pending multi-patient generation) |
| `EVIDENCE` (4) | ASSERTION · EVIDENCE_LINK · ANSWER_RUN · EVIDENCE_PACKET | **built + populated** |
| `OPERATIONAL` (10) | CLINICAL_ONTOLOGY · UNIT_REGISTRY · RULE_CATALOG · REVIEW_ISSUE · REVIEW_TASK · READINESS_STATE · SCHEME_REGISTRY · NOTIFICATION · SOURCE_SYSTEM · INGESTION_RUN | **built + populated** |

**34 tables marked `[B]` in `SPEC.md` §2. This list is generated from those markings and must stay equal to them.**

**7 designed-only, and they carry no `[B]` marking** — listed in `SPEC.md` §2 "Designed-only": `DERIVED_ARTIFACT` (retention purge for embeddings/caches), `CONSENT_ARTIFACT` (signed document store), `FHIR_MAPPING` (declarative path config), per-region search shards, `FACILITY_ONBOARDING`, `MODEL_RISK_REGISTER` as a table (ships as a markdown deliverable instead), `AUDIT_EXPORT`. **41 declared in total.**

**`HOUSEHOLD` and `HOUSEHOLD_MEMBER` were removed, not deferred** — family-floater coverage is out of scope by decision. See `DECISION-household-removal.md`.

**Created during platform verification and deliberately retained** in `SAARTHI.GOVERNANCE` as judge evidence: `ROLE_PATIENT_MAP` (precursor to `CARE_TEAM`), `R5_TEST_EVIDENCE`, `R5_TEST_CHUNK`, `R5_TEST_SEARCH`, `probe_owner_rights`, `probe_diff_owner`, `R5_OWNER_ROLE`, `TEST_AGENT`. **These are test scaffolding, not the system.**

---

## 3. Rules — 16 built + live-tested on JN89282

`SPEC.md` §4. Thresholds sourced in `research/clinical/clinical-thresholds.md`.

| Specialty | Rules | Threshold provenance | Build status |
|---|---|---|---|
| Medical oncology | 5 | NCCN/ASCO, ASCO-CAP 2018 | **built + live** — 28/28 fixture tests pass |
| Cardiology | 2 | FDA label, NCCN | **built + live** — SURV-LVEF-001 freshness-only, SURV-LVEF-002 delta rule (baseline-vs-current) |
| Nephrology | 1 | NCCN/FDA, Cockcroft-Gault | **built + live** — real Cockcroft-Gault evaluator with per-agent minima |
| Hepatology | 1 | FDA label | **built + live** — per-agent bilirubin thresholds |
| Endocrinology | 2 | CPOC 2022, NCCN v4.2024 | **built + live** — DEXA stratified T-score branch, HbA1c simple-threshold |
| General surgery | 1 | FDA label + ⚠️ practice consensus | **built + live** — 3-assertion check (wound/infection/clearance signature) |
| Cross-cutting | 4 | — | **built + live** — COV-AUTH (with letter-vs-table drift detection), COV-LIMIT, ID-LINK, ID-QUAR |

**Three thresholds carry ⚠️ and must be labelled as practice consensus wherever surfaced:** the 21-day general post-operative interval, the 42-day contaminated-wound extension, and the surgical-clearance checklist. **No guideline mandates them.** The anti-VEGF 28-day interval is the only genuinely hard post-operative gate (FDA label).

`ENDO-HBA1C-001` is `severity = 'advisory'` and **must never block** — CPOC 2022 and the Association of Anaesthetists both state cancer surgery should not be deferred for glycaemic optimisation.

---

## 4. Copilot — built + live end-to-end

`COPILOT-SPEC.md`. **Deployed and live on JN89282; the vertical slice is testable end-to-end.**

| Component | Status |
|---|---|
| `PATIENT_BINDING` + `bind_patient` — patient selection | **built + live** |
| Agent specification, 8 generic tools | **built + live** — SAARTHI_AGENT with 8 tool procedures |
| Class A/B classifier (keyword → structure → LLM → default A) | **built + live** — `classify_question.sql` |
| Answer validator, 6 checks | **partial** (not in the answer path; see section A) — procedure live on JN89282, all 6 checks; Check 4 uses AI_FILTER with return_error_details=TRUE (fail-closed); Check 5 uses 1% relative-numeric tolerance |
| R7 two-pass extraction | **built** — superseded: fired live on OS69400 on 3 Oct (68 assertions verified, 1 fail-closed); disagreement path still unexercised |
| Typed evidence contract, 3 kinds | **built** — structured / document_span / reference_clause |
| Conversation model — binding and `known_as_of` persist, history clears on switch | designed-only (frontend concern) |
| 10 Class B question types | **partial** — deep-case `ASK_SAARTHI` returned cited answers on JN89282; question-type coverage not measured |
| 12 named failure behaviours | **built** — `frontend/core/errors.py`, 10 tests, data-driven off `error_shape.json` |

---

## 5. Application — 6 screens

**Design system: `planning/research/design/DESIGN-SYSTEM.md`.** Grounded in three research
files in the same directory (1,526 lines) — Apple HIG fetched live, clinical UX evidence with
19 cited sources, and empirically probed Streamlit-in-Snowflake capabilities. Every token is
either traced to a source or explicitly marked as a judgment call.

| Screen | Status |
|---|---|
| Ask + Evidence ⭐ | **partial** — designed and built against fixtures. Masthead, claim ledger, persistent evidence margin, derivation trace, character-range citation highlight, Class A referral notice. **Not yet wired to the live tool procedures.** |
| Review Queue | **partial** — urgency-ordered, unowned issues flagged. Fixture-driven. |
| Patient 360 | **partial** — gate strip rebuilt to the status vocabulary. Facility timeline and discordance flags **not built**. |
| Review + History | **partial** — role restriction and idempotency demonstrable live. Fixture-driven. |
| Navigator View (4 languages) | superseded: `/navigator/[id]` exists in `web/` (4 Oct) |
| Judge Console (8 probes) | designed-only (SQL probes only; no UI) |

**(Historical, 20 Sept: the Streamlit screens read fixtures. Superseded: `web/` now reads live procedures, part A.)** The backend tool procedures exist and
are live (§6), but the frontend is not yet calling them. That wiring is the remaining step, and
nothing here should be described as end-to-end until it is done.

### Design decisions worth defending

| Decision | Basis |
|---|---|
| Status is a **glyph + word + border style**, never hue | WCAG 2.2 SC 1.4.1; 4–8% of Indian males are red-green deficient. The `🟢🔴🟠⚪` emoji this replaced were **identical in greyscale**. |
| Gate failures are **quiet and specific**, not alert tiles | ~90% override rate for interruptive CDS alerts; 95.1–99.3% for the top-50 DDI alerts (Phansalkar et al., JAMIA — confirmed full text). |
| `not_evaluated` styled **neutral and dashed**, never as failure | R3. "A missing lab does not mean ANC is low — it means we do not know." |
| Evidence margin is **persistent, never a modal** | Verifying a citation requires seeing claim and source simultaneously. |
| **Tabular numerals** on every value and timestamp | Digits align for comparison, and change in place rather than jittering when `known_as_of` moves. |
| Source pages render `white-space: pre`, not wrapped | A lab report is columnar; wrapping breaks the alignment where the `GM%` / `/CUMM` / lakh-comma traps live. |
| Type scale derived from **Apple's published macOS styles** at 1pt = 4/3px | `apple-hig-primary.md` §2.4. Body lands on 17px, matching Apple's iOS Body of 17pt. |

**Inter, not SF Pro.** SF Pro is not licensed for web redistribution. "Apple typography" here
means Apple's scale and restraint, not Apple's typeface. Do not claim SF Pro anywhere.

**Apple's current principles are eight** — Purpose, Agency, Responsibility, Familiarity,
Flexibility, Simplicity, Craft, Delight (verified live, 8 June 2026). The widely-repeated
"Clarity, Deference, Depth" is **retired** and should not be cited.

### Verified by screenshot — `planning/research/design/screens/`

Captured from the running app, not mockups. `05-gate-strip-greyscale-audit.png` is the
accessibility proof: with all colour removed, all four outcomes remain unambiguous.

### Known limitations of the current UI

1. **`char_start` / `char_end` work in the fixtures but the extraction pipeline does not populate them** (§R7 defect). Against live data the citation degrades to page level. `highlight()` handles bad offsets by degrading rather than raising, and there is a test for it.
2. **The SiS runtime Streamlit version is unverified.** Local is 1.64.0. `[[theme.fontFaces]]` and `st.html` need a deploy probe before being relied on.
3. **`st.html` output is invisible to Streamlit's `AppTest`.** Rendering is therefore asserted against pure builder functions in `test_answer_render.py`; page tests cover wiring only. This is stronger than what it replaced — the old tests asserted on `st.info` panel text and would have passed with the evidence pane in the wrong colour.
4. **Indian-script typography rests on a thin evidence base.** Devanagari/Tamil/Bengali need greater line-height than Latin; the sources are W3C drafts, not clinical research. Navigator View must state this.
5. `playwright` was installed into `venv/` as a screenshot tool. It is **not** an app dependency and is deliberately absent from `requirements.txt`.

---

## 6. Snowflake objects — inventory vs reality

Legend: 🟢 built + live on JN89282 · 🟡 partial · ⚪ designed-only.

| Type | Designed | Built |
|---|---|---|
| Database / schemas | 1 / 7 | 🟢 **1 / 7 — SAARTHI + 7 schemas live on JN89282** |
| Tables | 34 | 🟢 **35 built and populated** — 34 per SPEC + `SCHEME_REGISTRY`, `PRE_AUTHORIZATION` retired 23 Sept (columns merged into `AUTHORIZATION`) |
| Stages | 3 | 🟢 **3 built** — `PATIENT_DOCS`, `REFERENCE_DOCS`, `SKILLS` (all `SNOWFLAKE_SSE`) |
| Roles | 5 | 🟢 **5 built** — SAARTHI_APP, SAARTHI_COORDINATOR, SAARTHI_ONCOLOGIST, SAARTHI_NAVIGATOR, SAARTHI_JUDGE (+ SAARTHI_MCP_CLIENT least-priv for external MCP callers) |
| Row access policy | 1 | 🟢 **1 built** — `patient_scope` with reference-scope OR-branch, keyed on `CURRENT_USER()` per F3 |
| Masking policies | 2 | 🟢 **2 built** — `mask_direct_identifier`, `mask_dob` |
| Procedures | 11 | 🟢 **18 built + live** — bind_patient, evaluate_gates (all 16 rules dispatch), classify_question, validate_answer, chunk_documents, parse_documents_proc, extract_assertions_proc, reconcile_evidence_proc, refresh_readiness_proc, notify_proc, flatten_fhir_proc, orchestrator_proc, 8 tool procs |
| Tasks | 7 | 🟡 (JN89282) **6 of 7 built + live**; on OS69400 all 7 created suspended — parse_documents, extract_assertions, reconcile_evidence, notify, refresh_readiness, flatten_fhir, TASK_SAARTHI_ORCHESTRATOR (the headline-bonus "task on top") |
| Dynamic Tables | 5 | 🟢 **4 built + live** — DT_HARMONIZED_EVENTS, DT_REVIEW_QUEUE, DT_SCHEME_ELIGIBILITY, DT_TREATMENT_PLAN. Fifth listed as DT_DOC_CHUNK is a procedure not a DT (RAP-on-source forced synchronous population per F4) |
| Cortex Search services | 2 | 🟢 **2 built + live** — PATIENT_DOC_SEARCH, REFERENCE_DOC_SEARCH (WHO + NCD guidelines, 159 chunks) |
| Semantic view + VQRs | 1 + 6 | 🟡 **view built, verified queries NOT built** (0 of 6) |
| Agent | 1 | 🟢 **1 built + live** — SAARTHI_AGENT with 8 tools |
| MCP server | 1 | 🟢 **1 built + live, end-to-end verified** — `SAARTHI.OPERATIONAL.SAARTHI_MCP` exposes `SAARTHI_AGENT` as a single `CORTEX_AGENT_RUN` tool. Full path *external MCP client → server → agent (claude-opus-5) → tool procedure → answer* live-verified 23 Sept: `call "What is missing before Thursday?"` orchestrated `GetReadiness`, tool returned `no_patient_bound` (correct — MCP session has no bound patient), agent surfaced it verbatim without fabricating. Deliberate scope: no `SYSTEM_EXECUTE_SQL`, no raw-tool exposure. See `docs/MCP-QUICKSTART.md` for the 7-step reproduction. |
| Skills | 4 | 🟡 **4 definitions authored (59-63 lines each), not uploaded or referenced by the agent** |
| Eval datasets | 2 | 🟢 **2 built** — `data/eval/dev.jsonl` (40 rows) + `data/eval/held_out.jsonl` (40 rows) per SPEC §14 (80 total, corrected from earlier "80+80=160") |

**The v2 schema is live.** All 35 tables + 4 DTs + 6 tasks + 8 tool procedures + agent + MCP server + 2 search services deployed on JN89282. Cross-check via `python3 backend/scripts/check_gate.py --manifest` = PASS (55 active deploy steps).

---

## 7. Data and corpus

Legend: 🟢 built + live · 🟡 partial · ⚪ designed-only.

| Artifact | Status |
|---|---|
| Seeded fact ledger generator | 🟢 **built** — `data/generator/ledger.py` (247 lines), deterministic per seed; deep-case audit 23 Sept confirmed 14 named facts land in DB (7 identifiers, 0 ABHA, 4 facilities, 6 chemo cycles, appendectomy at FAC-03, discordant HER2, DEXA osteopenia, zoledronic infusion, 4 treatment-plan versions with supersession chain) |
| 100 synthetic patients | 🟡 **12 of 100 built + live** — PAT-DEEP-0001 (Baseerah, full ledger-driven) + 11 daycare cohort patients (PAT-DC-01..11 via `load_daycare_cohort.sql`), each shaped around one distinct blocker: DC-02 LVEF overdue on trastuzumab, DC-03 CBC 11d old, DC-04 platelets 82k, DC-05 ANC 1150, DC-06 PM-JAY pre-auth pending, DC-07 pre-auth table-vs-letter drift, DC-08 no CBC on record, DC-09 HbA1c 9.4 advisory, DC-10 HER2 IHC 2+ FISH pending, DC-01+DC-11 ready. Live-verified: `EVALUATE_GATES` on DC-04 returns `CLIN-PLT-001: fail (PLT is 82000, below threshold 100000)` with 12 other rules passing. Remaining 88 need `ledger.py` parameterisation (§5 gap 11) — row-count-only rows without variance rejected as theatre. |
| Deep case from the real record | 🟢 **built + audited** — PAT-DEEP-0001 (Baseerah) live on JN89282. 14 ledger facts present + 7 additional seeded (LVEF, HbA1c, creatinine, weight, bilirubin, AST, PM-JAY coverage + AUTHORIZATION); 28/28 rule-fixture tests pass end-to-end |
| Insurance and government schemes | 🟢 **built + live** — `CORE.COVERAGE` (payer_type ∈ {scheme, private_insurance, self_pay}, `annual_limit`, `used_amount`, `is_family_floater`), `CORE.AUTHORIZATION` (scheme + package_code + letter-vs-table drift + `denial_is_curable`), `OPERATIONAL.SCHEME_REGISTRY` (3 schemes seeded: PM-JAY central + TN-CMHIS + MH-MJPJAY), `DT_SCHEME_ELIGIBILITY` cross-joining patients × schemes. Rules `COV-AUTH-001` + `COV-LIMIT-001` live-tested including the conflicting-letter drift (SPEC §247 flagship). Dedicated extraction prompt `pass_a_claim.md`. PM-JAY manual PDF ingested into `REFERENCE_DOC_SEARCH`; 8 eval questions answered from it. Family-floater balances are flagged, never computed (SPEC decision — no HOUSEHOLD table). |
| 13 corruption scenarios | 🟡 **10 of 13 seeded and checked (3 by design, untested)** — Deep case covers 2, 3, 12 (HER2 grade+IHC discordance across specimens, appendectomy `clinical_complication`); scratch harness covers 7, 8 (LVEF stale, ID quar); `corruptions.py` covers 13 (rotated CBC photo, R7); `load_synthetic.sql` covers 1, 4, 5, 6, 9, 10 (late addendum, unit chaos GM%/mg%/g%, missing FISH bring-list, auth letter drift flagship, duplicate dedup, prompt injection). Remaining: 11 (cross-patient ID, handled by A1 design guarantee — agent tool schemas omit patient_id) + 2 needing R7 two-pass live-run infra not yet fired. |
| Synthetic PDF with Indian lab traps | 🟡 **built** — 1 of ~20 at 23 Sept; 22 more cohort PDFs added 3 Oct (one lab + one pathology per PAT-DC patient). `GM%`, `/CUMM`, `1,50,000`, `L`/`H` flags, differential-only neutrophils |
| Reference corpus Tier 1 | 🟢 **built + live** — WHO diabetes guideline (72 pages) + NCD treatment guidelines (87 pages) = 159 chunks in `REFERENCE_DOC_SEARCH`; cited answers verified via ASK_SAARTHI |
| 80 rule fixtures | 🟢 **built + live-tested** — `data/fixtures/rules/rule_fixtures.yaml`, 16 rules × 5 scenarios; `backend/scripts/run_rule_fixtures.py` runs 3-stage harness (structural + deep-case + scratch-patient), 28/28 PASS on JN89282 |
| 80 questions (40 dev + 40 held-out) eval | 🟢 **built** — `data/eval/dev.jsonl` + `data/eval/held_out.jsonl`. Covers Class A refusals, gate outcomes, missing/pending/superseded/unreadable, reference lookups, Hindi/Marathi/Bangla/Tamil, prompt-injection resistance |
| FHIR R4 bundles | 🟢 **built + live-verified 23 Sept** — `data/generator/fhir_from_db.py` reads DB rows and emits FHIR R4 Bundle dicts; `backend/scripts/generate_fhir_bundles.py` runs it for all 12 patients (149 total resources), loads into `RAW_FHIR_BUNDLE` and calls `flatten_fhir_proc`. Result: `{"events_written": 0, "pending_bundles": 12}` — expected idempotent outcome (all events already in `CLINICAL_EVENT`, `NOT EXISTS` filter fires). Full RAW_FHIR_BUNDLE → LATERAL FLATTEN → CLINICAL_EVENT pipeline live for the first time. Ledger-shaped `fhir_bundles.py` retained for deep case source-of-truth. |

---

## 8. CoCo lifecycle evidence

The brief requires evidence at **every** phase. Legend: 🟢 complete · 🟡 partial.

| Phase | Status |
|---|---|
| **Planning** | 🟢 **complete** — 52 sessions, 26 single-question research sessions, banked in `evidence/coco/planning.yaml` (381 lines) |
| **Development** | 🟢 **complete** — `evidence/coco/development.yaml` (145 lines), 3 stages spanning Danush's Days 1–5 scaffolding + Daksha's JN89282 deploy and extensions; every file_change carries a `verified_on: JN89282` entry |
| **Execution** | 🟢 **complete** — `evidence/coco/execution.yaml` (222 lines), 5 stages covering the full vertical-slice deploy; 6 recorded failure-and-fix pairs including AUTHORIZATION consolidation (23 Sept) |
| **Testing and validation** | 🟢 **built** (10 scenarios tested live; 3 handled by design, not tested) — `evidence/coco/testing_validation.yaml` (438 lines), 6 stages: 10 platform behaviour probes with query IDs, 28-live-test rule fixture harness, 13 corruption scenarios accounted for (10 tested + 3 by-design, untested), MCP external round trip, **9 failure-and-fix pairs** including the daycare cohort load discovery, prompt-injection inert-content proof, and the "Unknown UDF" grant fix from the MCP session. Named open gaps kept honest (multi-patient generation past 12, R7 live-run, frontend→live-backend wiring). |

**Failure-and-fix pairs are retained deliberately.** They are the most credible lifecycle evidence available and are not curated out.

---

## 9. Refused, with reasons

| Refused | Reason |
|---|---|
| Cortex ML and any trained predictive model | Brief: *"never opaque predictions."* Risk stratification is versioned SQL. |
| Clinical decision support | NMC TPG 2020 — a legal boundary. Class A refused for every role, including the treating oncologist. |
| Confidence percentages | A percentage invites a clinical decision; an evidence state invites a human to look. |
| Search sharding beyond 400M chunks | Documented in `SCALE-REVIEW.md`; out of scope at 100 patients. |
| FRAX fracture-risk scoring | Requires inputs we do not model. The T-score gate is the tractable one. |
| Real patient data in the system | 19 real reports informed **format research only**. Consent held; the patient's son is on the team. |
| Healthcare supply-chain / drug-substitute recommendation | Different clinician's question. Tools like SupplyFlowQC answer *"drug X is out — what substitute?"* for pharmacy/ops; SAARTHI answers *"is this patient ready for this procedure?"* for the treating team. Substitute-recommendation is also Class A under NMC TPG 2020, which we refuse for every role. Related shape we **do** build: `AUTHORIZATION.denial_is_curable` — flags procedurally recoverable insurance denials before admission (60–70% per RWR). |

---

## 10. Known limitations to state in the submission

Written now so they are not forgotten under deadline pressure.

1. **Engineering gates on synthetic tests are not clinical validation.** No rule here has been validated against real patient outcomes.
2. **Three thresholds are practice consensus, not guideline requirements.** Labelled ⚠️ in §3 and in the UI.
3. **Five NRCeS ABDM FHIR profile claims are unverified** — flagged in `fhir-field-mapping.md` §12. Base-FHIR paths are standard and stable.
4. **`ACCESS_HISTORY` lags up to 180 minutes.** Live probes use `QUERY_HISTORY`; the written pack uses `ACCESS_HISTORY`. Each is labelled.
5. **Competitor comparisons are historical and not re-verifiable here.** Their source is not vendored in this repo and the file:line citations are limited to those in `planning/research/clinical/ps04-competitive-landscape.md`; no "no competitor does this" claim is made in judge-facing material (FIX-ROUND-5).
6. **100 patients, not population scale.** Sharding and event-driven recomputation are documented, not built.
