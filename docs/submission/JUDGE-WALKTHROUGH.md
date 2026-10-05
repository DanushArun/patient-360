# Judge walkthrough: a 15-minute reading path

For a reviewer working alone with this repository and no Snowflake account. Rubric (organiser-published weights only,
no sub-weights): **Real-World Relevance 30, Technical Execution 40, Solution Completeness 30**
(`planning/PROBLEM-STATEMENT-verbatim.md`). Everything marked *reported* was observed on a named Snowflake account and
cannot be re-run offline. Everything marked *offline* you can re-run in step 0. Synthetic data only; engineering
checks are not clinical validation.

## Minute 0 to 3: run what can be run (Completeness: working, reproducible)

Follow the "Evaluate in 15 minutes" box in the [README](../README.md). Expected, as observed on 4 Oct 2026:
Python 375 passed / 14 skipped / 0 failed; web unit 257 passed; Playwright e2e 40 (stubbed API; one run of four gave
39 with one visual test failing, see [FIX-ROUND-7](../evidence/qa/FIX-ROUND-7.md)); typecheck and production build
clean. Then open `/design-preview/PAT-DC-07`: a **recorded fixture**, labelled as such, not live data.

## Minute 3 to 7: the problem and the boundary (Relevance, 30)

| Read | What to check |
|---|---|
| [README](../README.md) top, first two paragraphs | The user (day-care coordinator, family) and the question: what is missing, pending or conflicting before the next visit |
| [`backend/sql/procedures/classify_question.sql`](../backend/sql/procedures/classify_question.sql), [`web/lib/question-routing.mjs`](../web/lib/question-routing.mjs), [`docs/CLASSIFIER-TEST-SUITE.md`](CLASSIFIER-TEST-SUITE.md) | Class A (clinical judgment) is refused for every role; Class B is routed to deterministic tools. Legal basis: NMC Telemedicine Practice Guidelines 2020 ([`AGENTS.md`](../AGENTS.md) section 5) |
| [`docs/READINESS-CHECKS-EXPLAINED.md`](READINESS-CHECKS-EXPLAINED.md), [`data/fixtures/rules/rule_fixtures.yaml`](../data/fixtures/rules/rule_fixtures.yaml) | 16 versioned SQL rules, 80 fixtures. Never a model's opinion, never a confidence percentage |
| [`evidence/clinical/README.md`](../evidence/clinical/README.md) | Sourced thresholds; three are practice consensus and labelled so |
| [`docs/DATASET-LICENCES.md`](DATASET-LICENCES.md) | Synthetic-only position and licence inventory (per-file reference licences are not all verified) |

## Minute 7 to 12: the engineering (Technical Execution, 40)

| Read | What to check |
|---|---|
| [`docs/PLATFORM-FINDINGS.md`](PLATFORM-FINDINGS.md) | Seven dated platform findings with query IDs. Lead with this: it is the most reproducible evidence. Note the **open N4-03** box at the bottom |
| [`backend/sql/governance/01_policies.sql`](../backend/sql/governance/01_policies.sql) and [`backend/sql/deploy/07_governance_row_access.sql`](../backend/sql/deploy/07_governance_row_access.sql) | Row access policy keyed on `CURRENT_USER()`; `p_doc_id` fix; canary negative test (written, not yet run) |
| [`backend/sql/procedures/extract_one_document.sql`](../backend/sql/procedures/extract_one_document.sql) | R7: two passes, `llama3.3-70b` and `claude-haiku-4-5`, `temperature: 0`, fail closed. Live (OS69400, 3 Oct, reported): 68 assertions verified, 1 page failed closed. **The disagreement path has not fired live** |
| [`backend/sql/procedures/evaluate_gates.sql`](../backend/sql/procedures/evaluate_gates.sql) | Every status, number and threshold comparison comes from SQL |
| [`docs/FAILURE-AND-FIX-INDEX.md`](FAILURE-AND-FIX-INDEX.md) | 34 recorded failures with root cause, fix and verification status, including the ones still open |
| [`IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md) | Per-component ledger, `built | partial | designed-only`, with account and date |
| [`evidence/qa/`](../evidence/qa/) | Four independent QA rounds, five fix rounds, deploy rounds, uncurated |
| [`evidence/coco/`](../evidence/coco/README.md) | CoCo lifecycle manifests by phase. Session IDs have not all been re-confirmed by the team |

## Minute 12 to 15: completeness and honesty (Completeness, 30)

| Read | What to check |
|---|---|
| [`backend/sql/deploy/README.md`](../backend/sql/deploy/README.md) | The 10-step Snowsight bundle, with a VERIFY block per step. **Never run on a clean account** |
| [`evidence/qa/JUDGE-EVALUATION.md`](../evidence/qa/JUDGE-EVALUATION.md) | Our own adversarial self-assessment and its open gaps |
| [`docs/DECK-OUTLINE.md`](DECK-OUTLINE.md) | Outline and demo script only; the deck and video are produced separately |
| [`docs/TESTING-PLAYBOOK.md`](TESTING-PLAYBOOK.md), [`docs/PROTOTYPE-COST-CONTROLS.md`](PROTOTYPE-COST-CONTROLS.md) | How testing is run, and how cost was capped |

## What is not yet live, and known limitations

State of 4 Oct 2026. These are in the README limitations section too.

- **Localhost, single operator.** The dashboard runs on `127.0.0.1` with one pinned role (`SAARTHI_APP`). No hosting,
  no public URL, no per-user login. You cannot see the live product without your own Snowflake account.
- **Deploy bundle not run on a clean account.** `backend/sql/deploy/00` to `09` passes offline drift and contract
  checks only. Every `backend/sql` change from QA rounds 1 to 4 is `unverified-needs-deploy`.
- **N4-03 open.** The row access policy name-binding fix and canary test are in source; neither has run on Snowflake.
- **R7 disagreement path not exercised live.** Both readers agreed on every extracted field.
- **Eval not scored.** 80 questions are written (40 dev, 40 held out); 0 have been scored by a model; no baseline
  comparison. A scorer exists (`backend/eval/harness/score_results.py`) with no recorded results run in a QA round.
- **12 of 100 patients.** Synthetic: `PAT-DEEP-0001` and `PAT-DC-01` to `PAT-DC-11`; 22 generated cohort PDFs. The PDFs
  are generated from the same event snapshot they are checked against, so the 66 of 66 numeric linkage measures
  linkage, not independent extraction accuracy.
- **Co-pilot deferred.** `ASK_SAARTHI` is a thin agent wrapper; the answer validator exists but is **not in the answer
  path**; the reference-corpus scope selector is disabled in the UI.
- **Reference corpus not built into the product path.** 7 documents / 692 pages were reported loaded and searchable on
  3 Oct (OS69400); Search was suspended afterwards and no cited-answer run against it is recorded for the web app.
- **MCP is inbound only**, verified on the earlier account JN89282, not recorded on OS69400. No outbound action.
- **Tasks and Cortex Search suspended** for cost; a dedupe bug (stage `etag` vs `file_hash`) blocks resuming.
- **Skills authored, not loaded** into the agent (4 `SKILL.md`, no upload script, no `skills:` block).
- **No CI.** There is no `.github/` directory; offline tests are run by hand.
- **Deck and video produced separately** by the team; neither is in this repository.
- **Two accounts.** JN89282 (agent, MCP, 28 fixture tests, Sept) is historical; OS69400 (1-4 Oct) is current.
  Platform findings were established on FV11738 on 17 Sep. Figures are labelled per account.
- **No clinical validation.** Nothing here is clinical decision support.
