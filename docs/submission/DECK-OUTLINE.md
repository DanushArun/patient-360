# Deck outline and demo script

**The deck (T&C s4.5) and the demo video/recording are NOT produced.** This file is the content for the team to turn
into slides and a recording. Nothing here is a finished deliverable. Organiser approval is needed if a recording is to
substitute for a live demo (T&C s4.5, per `evidence/qa/JUDGE-EVALUATION.md`).

Rubric (`planning/PROBLEM-STATEMENT-verbatim.md`): Real-World Relevance 30 / Technical Execution 40 / Solution
Completeness 30. No sub-weights are published. Rules for every slide: synthetic data only; absolute counts with rates;
label live (reported from Snowflake, `QUERY_HISTORY`) vs offline (re-runnable) vs written-pack (`ACCESS_HISTORY`, up to
180 min lag); engineering gates on synthetic tests are not clinical validation; no "no competitor does this".

## Slide-by-slide

| # | Slide | Criterion | Content and evidence |
|---|---|---|---|
| 1 | Title and framing | - | SAARTHI, PS-04. One line: "which records, authorisations and checks are missing or conflicting before the next visit, with cited evidence." Synthetic data only |
| 2 | The problem | Relevance | Families travel 1,000+ km to a visit that cannot proceed because a report, authorisation or result is missing. Day-care coordinator and family navigator as users. Sources: `planning/WINNING-PLAN.md:30`, `planning/research/patient-reality/` (figures not re-verified by the fixer). Do not use the real patient story as sympathy leverage |
| 3 | What it answers, and what it refuses | Relevance | Class B (record state, cited) vs Class A (clinical judgment, refused; NMC TPG 2020). Evidence packet addressed to the named practitioner. Code: `backend/sql/procedures/classify_question.sql`, `backend/sql/agent/saarthi_agent.sql:24-40`, `web/lib/question-routing.mjs` |
| 4 | Architecture: seven rules | Execution | R1-R7 table (README). Diagrams: `planning/revised-architecture/ARCHITECTURE-DIAGRAMS.md` (15 diagrams), pages 6 (trust boundaries), 8 (R7), 15 (gate outcomes) |
| 5 | Platform findings that shaped the design | Execution | `evidence/coco/verification-query-ids.md`: RAP must key on `CURRENT_USER()` (F3), Cortex Search ignores RAP (F5), secondary roles defeat a USAGE control (F7), the agent injects `patient_id` from question text (A1) so tools omit it. Label: verified on JN89282 in Sept, query IDs recorded |
| 6 | Deterministic rules | Execution | 16 rules (`backend/sql/procedures/evaluate_gates.sql`), 5 fixtures each = 80 (`data/fixtures/rules/rule_fixtures.yaml`); 28 live fixture tests passed on JN89282 (reported). Three thresholds are practice consensus and labelled so. Example: `CLIN-PLT-001` on PAT-DC-04, platelets 82,000 against threshold 100,000 |
| 7 | Document pipeline and R7 | Execution | parse -> chunk -> two-family extraction (`llama3.3-70b` + `claude-haiku-4-5`, `temperature 0`) -> link -> gate. Live on OS69400 (3 Oct, reported): 22 cohort PDFs, 68 assertions all verified, 66 of 66 numeric values linked to one event, PAT-DC-08 pathology failed closed (`pass_b_invalid`). State: both readers agreed everywhere, so the disagreement path has not been exercised; documents come from the same event snapshot, so this measures linkage, not independent accuracy |
| 8 | Snowflake-native breadth | Completeness | 4 Dynamic Tables, 7 Tasks (suspended for cost), stream, 2 Cortex Search services, semantic view, Cortex Agent, inbound MCP server, `AI_PARSE_DOCUMENT`/`AI_COMPLETE`/`AI_FILTER`. Account column: JN89282 vs OS69400 (matrix in `JUDGE-EVALUATION.md` section 2) |
| 9 | Product: demo | Relevance + Completeness | Live demo or recording of the three patients below |
| 10 | Testing and failures kept | Execution | Offline, re-runnable (FIX-ROUND-5): Python 375 passed / 14 skipped; web unit 257; Playwright e2e 40 (stubbed API); `check_gate.py --manifest` PASS, 58 active steps; deploy-bundle drift check. Failure-and-fix pairs: `evidence/coco/execution.yaml` (6), `testing_validation.yaml` (9), `evidence/qa/` (QA rounds 1-4, FIX rounds 1-5, DEPLOY rounds 1-4). Engineering gate, not clinical validation |
| 11 | CoCo lifecycle evidence | Completeness | `evidence/coco/{planning (381 lines), development (144), execution (221), testing_validation (437)}.yaml`, `sessions-raw.csv`. Team to confirm each session ID is a real CoCo session |
| 12 | **What is not yet live** | Completeness (honesty) | See below |
| 13 | Repo, evidence and licences | Completeness | README map; `IMPLEMENTATION-STATUS.md`; `docs/DATASET-LICENCES.md`; synthetic data only |
| 14 | Close | - | Class A/B boundary, honest ledger, next steps |

### Slide 12: what is not yet live (state it on screen)

* Localhost, single operator, one pinned role. No hosted URL, no per-user login.
* Round-3/4 fixes and the `backend/sql/deploy/` bundle are not deployed or run on a clean account. Cross-patient negative test on `DOC_PAGE` after the latest policy change (N4-03) is not recorded.
* Answer validator (6 checks) exists but is not in the answer path; the MCP path bypasses it.
* R7 disagreement path (`conflicting` -> `not_evaluated`) not exercised live.
* Tasks and Cortex Search suspended; task dedupe bug open; no scheduled run shown.
* Skills authored (4) but not loaded into the agent; no outbound MCP action; no Judge Console UI (SQL probes only); no Streamlit app.
* Semantic view has 0 of 6 verified queries.
* 80 eval questions exist (40 dev, 40 held-out), 0 scored; no baseline-RAG comparison. Offline scorer only (`backend/eval/harness/score_results.py`).
* 12 of 100 patients; 10 of 13 corruption scenarios seeded.
* Reference corpus (7 documents, 692 pages) reported loaded on OS69400 but the reference scope is disabled in the UI.
* No clinical validation; no competitor claims beyond what is cited (competitor source not in this repo).

## Three-minute demo script

Pre-flight (off camera): live mode needs `SAARTHI_SNOWFLAKE_ENABLED=true`, a resumed warehouse and `NODE_USE_SYSTEM_CA=1
npm run dev:recording` (see `web/README.md`); otherwise use `/design-preview/PAT-DC-07` and say it is a recorded
snapshot. State at the start: "synthetic patients, localhost, single operator". Expected values below come from the
seeded data and gate definitions; verify each on the day, because the web build and Snowflake state have not been
re-run together since the last fixes.

| Time | Page | Click | What is shown (say it) |
|---|---|---|---|
| 0:00-0:20 | `/` Day care | Open the census; use patient search for "PAT-DC-04" | 12 synthetic patients, visit worklist, search scoped to authorised patients only |
| 0:20-1:05 | `/patient/PAT-DC-04` | Read the gate strip; open the platelet gate; open the cited lab fact | **PAT-DC-04: `CLIN-PLT-001` blocked, "PLT is 82000, below threshold 100000"** (from `evaluate_gates`, not a model). Each gate shows rule id and version, `known_as_of` and a source. Point at a `pending` or `not received` item and say it is not shown as negative (R3). Open the source page viewer (`/patient/PAT-DC-04/documents/<doc>`) to show the exact passage the lab fact links to |
| 1:05-1:55 | `/patient/PAT-DC-07` > Coverage | Click "Compare sources" | **PAT-DC-07 pre-auth conflict:** authorisation table says `pending`, the PM-JAY letter says `Approved`, valid until 2026-11-30; gate `conflicting`, with exact source spans. "Prepare review task" -> "Escalate to treating doctor": the follow-up draft is a draft, a human saves it. Move the `known_as_of` cutoff to before ingestion and show the letter disappears (R2) |
| 1:55-2:20 | `/patient/PAT-DC-07` > Ask the record | Ask "What is documented?" then "Is it safe to proceed?" | First: a cited record answer built from supplied facts. Second: **refused as Class A**; button "Prepare evidence packet for Dr <named practitioner>". Show the reference-scope option is disabled and say why |
| 2:20-2:40 | `/patient/PAT-DC-01` | Open the page | **PAT-DC-01** is a "ready" case (HER2 IHC 3+ in the seeded data): the product states ready only when every rule passes with evidence, and it still defers clinical decisions to the practitioner |
| 2:40-3:00 | `/review-queue`, then slide 12 | Open the queue, then `/history/PAT-DC-07` | Coordinator worklist of open gate failures (`DT_REVIEW_QUEUE` reported 17 rows on 3 Oct); task history. Close on the not-yet-live slide |

Do not claim in the video: hosting, a Judge Console, scheduled automation, a measured accuracy, validator-checked
answers, or a disagreement between the two extraction readers.

## Production checklist for the team

1. Build the deck from the table above; export to the required format; English only.
2. Record the demo from a resumed account and note query IDs shown on screen; re-check each expected value.
3. Decide what is committed to the repo before the freeze (AGENTS.md section 1).
4. Resolve the open items in `docs/DATASET-LICENCES.md` section 6 and `evidence/qa/FIX-ROUND-5.md`.
