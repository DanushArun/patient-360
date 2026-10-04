# SAARTHI - Judge-evaluator self-assessment

Date: 2026-10-04 (submission deadline day, 11:59 PM IST per T&C s1.1). Read-only evaluation: no source edited, no git writes, no credential files read, no SQL run against Snowflake. Offline gates re-run by me: `./venv/bin/python -m pytest -q` = 373 passed / 14 skipped / 0 failed; `python3 backend/scripts/check_gate.py --manifest` = PASS, 58 active deploy steps. Web suite figures (279 unit, 40 e2e) are from QA-ROUND-4, not re-run by me.

**This is a self-assessment against a rubric whose per-criterion scoring is discretionary. It is not a prediction of the result.** Synthetic engineering checks are not clinical validation (AGENTS s4).

---

## 1. Rubric as found

| Item | Statement | Source |
|---|---|---|
| Weights | Real-World Relevance 30% / Technical Execution 40% / Solution Completeness 30%; prize pool $10,000 | `planning/PROBLEM-STATEMENT-verbatim.md:19,57`; `planning/WINNING-PLAN.md:12` |
| Sub-criteria | None published. "No published bonus weights were found"; scoring detail discretionary (T&C s9) | `planning/research/winning-review-2026-09-23/competition-and-plans.md` ("Mandatory requirements versus optional signals"; T&C list) |
| Track | PS-04 Patient and Member 360 and Clinical or Regulatory Document Copilot | verbatim.md:9 |
| Core obligations | (1) patient OR member 360, synthetic/de-identified only; (2) combine structured records with unstructured clinical/regulatory/legal docs; (3) risk stratification, evidence retrieval or cited answer, never opaque predictions; (4) Q&A experience with clear source evidence; (5) CoCo evidence across Planning, Development, Execution, Testing | verbatim.md:11-45 |
| CoCo tasks recommended | Synthetic data; pipelines (DTs, tasks, streams); semantic model + ontology + verified queries validated against NL questions; Streamlit app; MCP to external tools; document processing | verbatim.md:30-36 |
| Ingenuity | Reusable skills ("headline bonus"); MCP connectors / cross-tool action; automations/scheduled runs; custom tools; multi-agent orchestration; multiple surfaces (CLI, Desktop, Snowsight Cloud Agents, Slackbot); guardrails and graceful fallback | verbatim.md:38-45 |
| Submission artifacts (T&C) | Deck (s4.5), accessible full source (s4.5), dataset identification and licences for non-Snowflake data (s4.3b), English only (s4.2), entry frozen after deadline (s4.1); finalists demo live, a recording needs organiser approval (s4.5) | competition-and-plans.md T&C list |
| Timeline | Submit by 4 Oct; unattended evaluation 5-22 Oct; shortlist 23 Oct; finale 27-30 Oct | verbatim.md:49-55 |
| Internal (not organiser) rules | R1-R7; Class A/B; honesty rules; the "18 days alone" framing is an interpretation, not a verified review duration | AGENTS.md s2,4,5; competition-and-plans.md "Avoid certainty" |

Note: `planning/WORK-PLAN.md` contains no rubric; it is the build plan.

---

## 2. Per-criterion self-assessment (estimate, not prediction)

Scale: points out of the criterion weight. Ranges reflect that scoring is discretionary and that I could not inspect any live deployment.

### Real-World Relevance (30): estimate 21-25

Evidence for:
- Concrete, quantified problem and a defensible user (day-care coordinator, family navigator): `planning/WINNING-PLAN.md:30`. Quantification sources are in `planning/research/patient-reality/`; I did not re-verify each figure.
- Class A/B boundary grounded in NMC TPG 2020 and enforced in three places: `backend/sql/procedures/classify_question.sql`, agent instructions (`backend/sql/agent/saarthi_agent.sql:24-40`, refuses clinical judgment without calling a tool), web routing (`web/lib/question-routing.mjs`, `web/lib/question-routing.test.mjs`).
- Clinical thresholds are sourced and checkable by a lay reader: `evidence/clinical/README.md`, runnable `backend/scripts/verify_clinical_proof.py`.
- Real PM-JAY / AIIMS / ICMR / FDA corpus: `data/reference/` (7 PDFs); STATUS reports 7 docs / 692 pages loaded and Search verified on OS69400 (live claim, not re-verifiable offline).

Evidence against:
- Headline "is she ready for the next step" framing still sits in README line 7; the competition review itself says the first demo question should be operational, and ambiguous readiness defaults to Class A. See claim C-9.
- The 2026-09-23 live audit (`docs/COMPLETENESS-MAP.md`) states the dashboard "is not an end-to-end Patient 360": 9 of 13 PAT-DC-04 rules showed no source evidence ID. Round-3 fixes address some of it in source only.
- 12 patients, not 100 (STATUS s7).

### Technical Execution (40): estimate 24-30

Evidence for (strong, verifiable offline):
- R5/R3 platform facts are real design findings with query IDs: `evidence/coco/verification-query-ids.md` (RAP on `CURRENT_USER()`, Cortex Search ignores RAP, agent injects patient_id). RAP body keys on `CURRENT_USER()` only: `backend/sql/governance/01_policies.sql:46-72` (QA-ROUND-4 N3-05).
- R7 two families, both pinned, `temperature: 0`, no `orchestration: auto`: `backend/sql/tasks/extract_assertions.sql`, `backend/sql/procedures/extract_one_document.sql` (QA-ROUND-4 N4-07). Live result (STATUS 3 Oct): 68 assertions all verified, PAT-DC-08 pathology failed closed (`pass_b_invalid`), 66/66 numeric values linked to one structured event.
- Deterministic 16-rule engine with fixtures: `backend/sql/procedures/evaluate_gates.sql`, `data/fixtures/rules/rule_fixtures.yaml`, `backend/scripts/run_rule_fixtures.py` (28 live tests were reported against JN89282; not re-runnable offline).
- Offline test depth: 373 pytest + 279 web unit + 40 Playwright; deploy bundle drift check `backend/scripts/build_deploy_bundle.py --check`; manifest gate `check_gate.py`.
- Snowflake-native breadth is genuine (see matrix below).
- Failures recorded rather than hidden: `evidence/coco/execution.yaml`, `testing_validation.yaml`, `evidence/qa/*` (4 QA rounds, 3 fix rounds, 3 deploy rounds, findings N4-01..N4-07).

Evidence against:
- No Round-4 fix has been deployed; `evidence/qa/QA-ROUND-4.md` says everything in `backend/sql` is `unverified-needs-deploy`, and finding N4-03 (RAP subquery may bind `doc_id` to the inner table, making the policy return every `DOC_PAGE` row) is the single most important unresolved security question. No recorded cross-patient negative test on `DOC_PAGE`.
- The 6-check answer validator exists (`backend/sql/procedures/validate_answer.sql`) but is not in the answer path: `backend/sql/agent/ask_saarthi.sql` is a thin `DATA_AGENT_RUN` wrapper; `web/README.md` and `web/lib/patient.ts:10` both say the guard is deferred. The MCP path also bypasses it (`docs/WORKSPACE-BASELINE-2026-09-30.md:95`).
- No evaluation harness or results: `backend/eval/{harness,results,ground_truth,questions,adversarial}` are all empty directories. 80 questions exist (`data/eval/dev.jsonl` 40, `held_out.jsonl` 40) but nothing measured against them; no baseline-RAG comparison.
- The semantic view has zero verified queries (grep of `backend/sql/semantic/01_semantic_view.sql` finds none) and the agent has no Cortex Analyst tool. The brief asks for verified queries validated against NL questions. See Snowflake-depth matrix.
- Tasks are suspended on purpose (cost + a dedupe bug: etag vs SHA-256 `file_hash`), so "scheduled/automated runs" are not demonstrated live.
- Live evidence is split across two accounts: JN89282 (23 Sept: agent, MCP, 28 fixtures) and OS69400 (1-4 Oct: current web, documents, Search). OS69400 has no recorded agent/semantic view/MCP deployment in the evidence I read.

### Solution Completeness (30): estimate 14-20

Evidence for:
- Complete CoCo lifecycle manifests: `evidence/coco/planning.yaml` (381 lines), `development.yaml` (144), `execution.yaml` (221), `testing_validation.yaml` (437).
- Full architecture corpus, 15 diagrams, honest status ledger with dated checkpoints, QA trail.
- Working local dashboard routes: `/`, `/patient/[id]`, `/review-queue`, `/navigator/[id]`, `/history/[id]`.

Evidence against:
- No Judge Console UI anywhere (`web/app` has none; `frontend/pages/` holds only `.gitkeep`); the 8 probes exist as SQL only (`backend/sql/procedures/judge/judge_probes.sql`), and README lists it as screen 6.
- No hosted/URL app: web is Next.js on 127.0.0.1 with a single operator role; Streamlit pages were removed from the tree. The brief's recommended task #4 is Streamlit. A judge cannot see the product without their own Snowflake account and keys.
- No deck, no demo video, no dataset/licence inventory, no model-risk register found in the repo (filename search, scoped).
- README has no quickstart (a stranger cannot follow it); the working path is `backend/sql/deploy/README.md` (Snowsight bundle) and `web/README.md`.
- Skills: four `SKILL.md` files exist, but `backend/sql/setup.sql:268` marks `upload_skills.sql` `[NOT BUILT]`, the agent spec has no `skills:` block, and `backend/skills/reuse-tests/` is empty. The "task on top" (`backend/sql/tasks/orchestrator.sql`) orchestrates procedures (parse -> chunk -> extract -> refresh), not skills.
- MCP: an inbound MCP server over the agent (`backend/sql/agent/saarthi_mcp.sql`) is built; the brief's outbound "turn read-only into cross-tool action" (e.g. ticket creation) is not demonstrated. Notifications write rows to `NOTIFICATION`; I found no external send.
- 12 of 100 patients, 10 of 13 corruption scenarios, 1 doc for 11 patients before the 3 Oct cohort documents (22 pages now).

### Aggregate (self-assessed)

Weighted point estimate 59-75 of 100, centre of mass in the mid-60s. The Technical Execution score depends most on whether a judge can see the OS69400 pipeline and RAP behave as claimed; Completeness depends on missing packaging artifacts, most of which cannot be fixed by code.

### Snowflake-native depth matrix

| Capability | In repo | Deployed evidence | Gap |
|---|---|---|---|
| Cortex Search x2 (R6) | `backend/sql/search/01,02` | Active on OS69400 (STATUS 3 Oct, 692 + 26 rows); scoped retrieval tested | Suspended afterward (cost) |
| Row access policy on `CURRENT_USER()` | `governance/01_policies.sql:46-72` | Verified F3 (query IDs) | N4-03 unresolved on current build |
| Masking policies x2 | `governance/` | JN89282 only | None recorded on OS69400 |
| Dynamic Tables x4 | `backend/sql/dynamic_tables/` | Resumed, `DT_REVIEW_QUEUE` 0 -> 17 rows | AI steps correctly in Tasks (fact 9) |
| Tasks / Streams | `backend/sql/tasks/` (7), `streams/` | Created suspended on OS69400; chain run manually | Not running on a schedule; etag dedupe bug open |
| AI functions (`AI_PARSE_DOCUMENT`, `AI_COMPLETE`, `AI_FILTER`) | procedures + tasks | Parse + 2-family extract live (68 assertions) | `AI_FILTER` polarity check live only on JN89282 and only structurally |
| Semantic view | `semantic/01_semantic_view.sql` | JN89282 | No VQR, not consulted by agent, not validated against NL questions |
| Cortex Agent | `agent/saarthi_agent.sql` (pinned `claude-opus-5`, 8 generic tools, no patient_id) | JN89282 | Not recorded on OS69400; skills block absent |
| MCP server | `agent/saarthi_mcp.sql`, `scripts/mcp_client.py`, `docs/MCP-QUICKSTART.md` | Query ID `01c74481-0003-92e6-0001-fca600116122` (JN89282) | Inbound only; bypasses answer guard |
| Streamlit-in-Snowflake | `frontend/` (pure functions + tests) | None | Screens removed; web/ is Next.js |
| Git integration / one-script deploy | `setup.sql` (58 steps), `scripts/deploy.sh`, `backend/sql/deploy/00-09` Snowsight bundle | Bundle never run on a clean account | Clean-account reproduction unproven |

### R1-R7 demonstrability (what a judge can verify)

| Rule | Demonstrable from repo offline | Needs live |
|---|---|---|
| R1 | Gate SQL (`evaluate_gates.sql`), contract tests, agent prompt forbids unsourced statements | Agent compliance |
| R2 | `known_as_of` in tools and web contract tests (`web/lib/answer-contract.test.mjs`) | Time-travel replay |
| R3 | `value_state` CASE shared by timeline and labs (`06_get_timeline.sql:117-126`, `web_reads.sql:515-522`), test `test_timeline_and_labs_share_one_value_state_rule_in_sql` | Runtime unproven (N3-01) |
| R4 | `bind_patient.sql`, `ID-QUAR-001`, `ID-LINK-001`; `PATIENT_BINDING` | ABHA absent by design for the deep case |
| R5 | Three layers present in source; tool schemas omit patient_id (`tool_signatures.yaml`) | Cross-patient negative on `DOC_PAGE` (N4-03) |
| R6 | Two search SQL files, un-RAP'd `DOC_CHUNK` | Reference scope selector is disabled in UI (`reference_scope_unavailable`) |
| R7 | `extract_assertions.sql`, `extract_one_document.sql`, prompts; `PAT-DC-08` fail-closed in STATUS | Disagreement path never exercised: STATUS says both readers agreed on every field, "shows nothing about disagreement handling" |

---

## 3. Prioritised gap list (points at stake x ease)

Priority = my judgement of rubric points x how cheaply it closes. Tag key: **[OFFLINE]** fixable offline in repo; **[DEPLOY]** needs Snowflake deploy; **[TEAM]** needs human/team (deck, video, demo, accounts).

| # | Gap | Criterion at stake | Tag | Why / action |
|---|---|---|---|---|
| 1 | No pitch deck (required by T&C s4.5) and no dataset/licence inventory (s4.3b) | Completeness; possibly eligibility | [TEAM] (licence table draft is [OFFLINE]) | Draft `docs/DATASETS-AND-LICENCES.md` listing: synthetic generator output (own), 7 reference PDFs with source URL and licence status, standards/thresholds. Deck is human work. |
| 2 | README has no quickstart or judge path; claims screens that do not exist | Completeness; honesty | [OFFLINE] | Add "Judge path" section (what to run, expected output, what is live vs source-only); fix claims C-1..C-9 below. Cheapest, highest return. |
| 3 | No demo video / recorded walkthrough; nothing running at a URL | Completeness; Relevance | [TEAM] | A recording of the live OS69400 flow with query IDs. Link from README. Mark organiser approval needed to substitute for live demo. |
| 4 | Round-4 bundle (`backend/sql/deploy/00-09`) never run on a clean account; N4-01/02/05 ordering and half-deploy risks | Execution; Completeness | [DEPLOY] + [OFFLINE] | Offline: reorder grants before tasks in `04_tasks_and_grants.sql`, add procedure existence check to `00_preflight.sql` (N4-06), add "if 04 fails re-run first" to deploy README. Then deploy and record query IDs. |
| 5 | RAP `doc_id` binding (N4-03) unverified; no cross-patient negative test on `DOC_PAGE` | Execution (security headline) | [DEPLOY] | Qualify the column (`d.doc_id = patient_scope.doc_id`-style) offline, then run a two-user negative test and record the query ID in `verification-query-ids.md`. Biggest single credibility risk because R5 is the headline claim. |
| 6 | Answer validator not in answer path (ask path and MCP both unguarded) | Execution; R1/R7 claims | [OFFLINE] + [DEPLOY] | Offline: relabel STATUS to partial (done in section 4). Wiring `validate_answer` into `ASK_SAARTHI` is a code change plus deploy; if not done, say so on screen and in README. |
| 7 | No eval harness/results (`backend/eval/` empty); 80 questions never scored; no baseline | Execution (accuracy evidence) | [OFFLINE] harness; [DEPLOY] run (paid) | Even a 10-question classifier run on `question_classification.sql` with absolute counts beats nothing. Report absolute counts, cold start separate. |
| 8 | Judge Console not built as UI; probes exist as SQL only | Completeness; Relevance (demo) | [OFFLINE] minimal route or documented SQL script; [DEPLOY] | Either ship a single read-only page that runs `judge_probes.sql` or state "Judge Console: SQL probes only" everywhere. Do not list it among six screens. |
| 9 | R7 disagreement path never exercised live (both readers agreed everywhere) | Execution; Relevance (the differentiator) | [DEPLOY] | The page with a seeded conflicting value (corruption 13) needs one paid two-pass run; record the `conflicting` -> `not_evaluated` gate result. |
| 10 | Semantic view lacks verified queries; not tied to agent; not validated against NL questions | Execution (named CoCo task #3) | [OFFLINE] VQRs; [DEPLOY] validate | Add VQRs only if SPEC allows (SPEC lists 6 VQRs; AGENTS s6 forbids features not in SPEC, and VQRs are in SPEC). Otherwise mark designed-only. |
| 11 | Skills not wired: `upload_skills.sql` NOT BUILT, no `skills:` in agent, `reuse-tests/` empty, orchestrator orchestrates procs | Completeness (named headline bonus) | [OFFLINE] + [DEPLOY] | Build `upload_skills.sql` (COPY INTO pattern in `backend/skills/README.md`), add skills block, write the second-schema reuse test with one refused ambiguity. Until then claim "4 skill definitions authored, not loaded". |
| 12 | STATUS contradicts itself (date headers 20/23 Sept vs 4 Oct; "4 of 6 screens fixture" vs Next.js; "R7 has not fired" vs 68 live assertions; JN89282 counts presented as current) | Honesty; Completeness | [OFFLINE] | Rewrite as a single dated table keyed by account (JN89282 historical, OS69400 current). See section 4. |
| 13 | Two Snowflake accounts, evidence split; judges cannot reproduce either | Completeness | [TEAM] | Record which account holds the submission build; note both account IDs in README without credentials. Credits: prototype monitor at 1.57/2.00 used (STATUS 3 Oct), tasks and Search suspended. |
| 14 | Hosted/per-user app absent (single-operator dev role, localhost only) | Completeness; Relevance | [TEAM]/[DEPLOY] | Likely out of reach today; state plainly. A hosted Streamlit-in-Snowflake page would also match brief task #4. |
| 15 | MCP outbound action (ticket) and notifications to an external channel not demonstrated | Completeness (ingenuity bonus) | [DEPLOY] | Wording fix now; a single reviewed outbound call only if time permits and idempotency is shown. |
| 16 | Competitor comparison lacks file:line (`planning/revised-architecture/FINAL-VALIDATION.md` has 2 line-style cites against dozens of cells) | Honesty (AGENTS s4) | [OFFLINE] | Either add repo/commit/file:line per cell or delete the table from anything judge-facing; README currently links the file as "validation against ... every competitor". |
| 17 | Task chain etag-vs-hash dedupe bug blocks resuming tasks (paid duplicates); automation not demonstrable | Execution (execution phase) | [OFFLINE] + [DEPLOY] | Key dedupe on `file_hash`; then resume the chain and capture one scheduled run. |
| 18 | Stale/duplicate artefacts in tree: `frontend/pages/` empty, `backend/sql/stubs/`, 6 stale cohort PDFs, `web/snowflake.log`, root `snowflake.log`, root `apollo-department-register.docx`, `docs/TESTING-PLAYBOOK.md` embeds a teammate key path | Hygiene; privacy of paths | [OFFLINE] | Remove or gitignore; scrub the playbook path. (I did not open the log files.) |
| 19 | 12 patients, 10 of 13 corruption scenarios, 22 cohort pages | Completeness | [OFFLINE] data / [DEPLOY] | State absolute counts everywhere; do not chase 100. |
| 20 | CoCo evidence provenance: `evidence/coco/*.yaml` mix author sessions; the competition review warns that non-CoCo work must not be labelled CoCo | Honesty | [TEAM] | One reviewer to confirm each session ID corresponds to a real CoCo session. |

---

## 4. README / STATUS claims not demonstrable from the repo (with corrected wording)

| ID | Location | Claim | Problem | Corrected wording |
|---|---|---|---|---|
| C-1 | README.md:34-44 | "The 6 screens ... 6. Judge Console - live security probes ..." | No Judge Console UI exists; `frontend/pages/` is empty; `web/app` routes are home, patient, review-queue, navigator, history, design-preview. Several probes named are SQL-only. | "Five routes in the Next.js dashboard (census, patient workspace, review queue, navigator, history). Judge Console is SQL probes only (`backend/sql/procedures/judge/judge_probes.sql`), no UI." |
| C-2 | README.md:86 | "`frontend/` - Streamlit-in-Snowflake app: frozen contracts, core, components, fixtures and current entry point" | Streamlit pages were removed; no SiS deployment exists. Current UI is `web/`. | "`frontend/` holds contracts, pure rendering helpers and fixtures from an earlier Streamlit build; the current UI is `web/` (local Next.js)." |
| C-3 | README.md:82 | "4 skills ... orchestrated by one Task" | Skills are not uploaded or referenced by the agent; orchestrator Task chains procedures. `reuse-tests/` empty. | "Four skill definitions are authored (`backend/skills/`), not yet loaded into the agent. `TASK_SAARTHI_ORCHESTRATOR` chains parse, chunk, extract and refresh procedures." |
| C-4 | README.md:84 | "`backend/eval/` - question sets, ground truth, adversarial probes, harness, results" | All five subdirectories are empty. | "`backend/eval/` is a placeholder; the 80 questions live in `data/eval/` (40 dev, 40 held-out) and have not been scored." |
| C-5 | README.md:50 | Class B "answered ... across 10 question types" | Not demonstrated by a test run in the repo; STATUS cites only "deep-case ASK_SAARTHI returns cited answers" (JN89282). | "Class B questions are routed to deterministic tools; question-type coverage is not yet measured (see `data/eval/`)." |
| C-6 | STATUS s4 | "Answer validator, 6 checks - built + live" | Procedure deployed on JN89282; not called by `ASK_SAARTHI` or MCP; `web/README.md` says guard deferred. Check 4 `AI_FILTER` only tested structurally. | "partial - procedure built; not wired into the answer path." |
| C-7 | STATUS s4 | "R7 two-pass extraction - built (has not yet fired live)" | Contradicted by the 3 Oct entry (68 assertions on OS69400). | "built - fired live on OS69400 (68 assertions verified, 1 fail-closed). The disagreement path has not been exercised." |
| C-8 | STATUS s5 (screens) | "All four built screens read fixtures"; "Navigator, Judge Console designed-only" | Superseded: Next.js reads live procedures; Navigator route exists. | Replace the table with the current routes and state "Judge Console: SQL only." |
| C-9 | README.md:7 and WINNING-PLAN s7 | "Answer ... whether a cancer patient is ready ... clinically, documentationally and financially" | The product answers record-state questions; clinical readiness is Class A and refused. | "Answer, with cited evidence, which records, authorisations and checks are missing or conflicting before the next scheduled visit. Clinical judgment remains with the treating practitioner (Class A, refused)." |
| C-10 | STATUS s6 | Rows marked "built + live" for Agent, MCP, semantic view, 35 tables, 55 steps | True on JN89282 on 23 Sept, not recorded on the current account OS69400; manifest is now 58 steps. | Add an "Account" column; mark JN89282 as historical and OS69400 as current with last verified date. |
| C-11 | STATUS s6 | "Dynamic tables 4/4" + "Tasks 6 of 7" as live | On OS69400 all 7 Tasks are created suspended (STATUS 3 Oct); Search services suspended. | "created; suspended to control cost; chain exercised manually." |
| C-12 | STATUS s6 | "Semantic view + VQRs: 1 built" | No verified queries in file; SPEC says 6 VQRs. | "Semantic view built; verified queries not built." |
| C-13 | STATUS s7 | "13 corruption scenarios - 10 of 13 built + live-verified" and "Synthetic PDF with Indian lab traps - 1 of ~20" | Latest pass added 22 cohort PDFs; line is stale; scenario 2 and 11 per-claim sources not found in repo. | Report "12 patients, 28 active documents on OS69400 (3 Oct); 10 of 13 corruption scenarios seeded" with absolute counts, per account. |
| C-14 | STATUS s8 | "Testing and validation - built", "all 13 corruption scenarios accounted for" | Includes 3 "by design", which are not tests. | "10 scenarios tested live; 3 handled by design, not tested." |
| C-15 | STATUS header | `built` defined as "reproducible from `setup.sql` on a clean account" | No clean-account reproduction has ever been recorded; setup.sql contains `[NOT BUILT]` lines (e.g. `setup.sql:268`). | Define `built` as "deployed on a named account and exercised"; add `reproduced-clean-account: no`. |
| C-16 | STATUS s1 / WINNING-PLAN | "No competitor does this" (two-pass), "consent ... no competitor has it", "Every competitor's access control is cosmetic" | Violates AGENTS s4 (file:line citations); the winning-review itself flags it. | Cite repo/commit/file:line per competitor or restate as "we did not find this in the code we reviewed (list of files)". |
| C-17 | planning/revised-architecture/FINAL-VALIDATION.md, README.md:67 | Linked from README as "Validation against the verbatim brief, rubric, and every competitor"; claims 0 contradictions and still lists HOUSEHOLD | Historical snapshot; two line cites for ~30 comparison cells. | Label "historical, 17 Sept, superseded by `DECISION-household-removal.md`" in the README table. |
| C-18 | README.md:3-4, 16 | "30 September baseline ... Live data views remain blocked under `SAARTHI_APP`" | Stale versus STATUS 3-4 Oct (live views working on OS69400). | Replace with the 4 Oct baseline and one pointer to STATUS. |
| C-19 | STATUS s4 | "MCP ... built + live end-to-end verified" | True for inbound agent exposure on JN89282 only. The brief's MCP intent (cross-tool action) is not shown; MCP path has no answer guard. | "Inbound MCP server over the agent verified on JN89282 (query ID `01c74481-...`). No outbound action. MCP calls are not passed through `validate_answer`." |
| C-20 | STATUS (3 Oct) | PAT-DC cohort "Linker 66 of 66 numeric values link to exactly one structured event" | Only checkable against the live account; cohort docs are rendered from the same events they are checked against, so agreement is circular evidence for extraction accuracy. | Add: "documents are generated from the same event snapshot; this measures linkage, not independent extraction accuracy." |

Items I checked and found accurate: R-rules table in README matches AGENTS; Class A/B definition; `data/eval` 40+40; evidence YAML line counts (381/144/221/437); `check_gate.py` 58 steps (README says nothing contradictory; STATUS 55 is stale); failure-and-fix practice (kept, not curated).

---

## 5. Submission checklist

| Artifact | Source | Present? | Notes |
|---|---|---|---|
| Accessible full source | T&C s4.5 | Yes (git repo) | Large uncommitted working tree at the time of writing; branch state is the user's call (AGENTS s1). `git status` shows many modified and untracked files including `backend/sql/deploy/`, `evidence/qa/`. Decide what is committed before the freeze. |
| Deck | s4.5 | **No** | None found. [TEAM] |
| Demo video / recording | WINNING-PLAN s5 | **No** | [TEAM] |
| README a stranger can follow | WINNING-PLAN s6 | **Partial** | No quickstart; path buried in `backend/sql/deploy/README.md` and `web/README.md`. |
| One-script deploy on clean account | WINNING-PLAN s6 | **Partial** | `setup.sql` + Snowsight bundle exist; never run clean; N4-01/02/05 open. |
| Re-runnable test results | WINNING-PLAN s6 | **Yes (offline)** | 373 pytest, 279 unit, 40 e2e; `check_gate.py`. Live results not re-runnable without account. |
| `IMPLEMENTATION-STATUS.md` honest | AGENTS s4 | **Partial** | Dated entries are candid; the body is stale/contradictory (C-6 to C-15). |
| CoCo evidence, 4 phases | verbatim.md:23-28 | **Yes** | `evidence/coco/{planning,development,execution,testing_validation}.yaml`, `sessions-raw.csv`, `verification-query-ids.md`; provenance to be reconfirmed (gap 20). |
| Failure-and-fix records | AGENTS s4 | **Yes** | execution.yaml (6), testing_validation.yaml (9), QA rounds 1-4. |
| Dataset identification and licences | T&C s4.3b | **No** | Reference PDFs in `data/reference/`; no licence table. |
| Synthetic-only statement | brief | **Yes** | README line 9, AGENTS; real reports described as format research with consent. |
| Ontology artifact | verbatim.md:33 | **Yes** | `backend/sql/data/ontology.sql` (`CLINICAL_ONTOLOGY`, `UNIT_REGISTRY`). |
| Semantic view + verified queries | verbatim.md:33 | **Partial** | View yes, VQRs no. |
| Agent / skills / MCP | verbatim.md:38-45 | **Partial** | Agent and inbound MCP yes (JN89282); skills authored not loaded; no outbound action. |
| Pipelines (DT, tasks, streams) | verbatim.md:32 | **Yes** | 4 DTs, 7 tasks, stream; tasks suspended. |
| Streamlit/app | verbatim.md:34 | **Partial** | Local Next.js, single operator, no hosting. |
| Multi-surface evidence (Snowsight Cloud Agents, Slackbot) | verbatim.md:44 | **No** | Not found. |
| Eval results with absolute counts | AGENTS s4 | **No** | `backend/eval/` empty. |
| Model-risk register | WINNING-PLAN/STATUS | **No** | Listed as "ships as markdown deliverable"; not found. |
| Limitations stated | AGENTS s4 | **Yes** | STATUS s10; engineering-not-clinical disclaimers. |
| Class A/B enforced and testable | AGENTS s5 | **Yes (source)** | Classifier + agent prompt + web router + `docs/CLASSIFIER-TEST-SUITE.md`. |
| Credentials hygiene | - | **Check** | `snowflake.log` at repo root and `web/snowflake.log`, `docs/TESTING-PLAYBOOK.md` with a teammate key path: confirm not committed (not opened by me). |

---

## 6. Caveats of this evaluation

- I verified file existence, counts, source text and offline tests. I did not and could not verify any live Snowflake claim; where STATUS or evidence YAML reports a live result I labelled it as reported.
- Scores are my estimates under uncertainty about the judges' emphasis; the organiser publishes no sub-weights.
- Statements about competitors are taken from the repo's own documents and were not re-verified.
