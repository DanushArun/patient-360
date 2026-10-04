# Deploy plan, round 1 fixes (run in Snowsight as ACCOUNTADMIN)

Why this is manual: the CLI profile is blocked by the account network policy and SAARTHI_APP cannot run DDL.
All files below are idempotent (`CREATE OR REPLACE`). Do NOT run `setup.sql`: `tables/20_core.sql` drops CORE.PATIENT, ID_MAP,
ENCOUNTER, COVERAGE and AUTHORIZATION on every run. Paths are relative to `backend/sql/`.
Use one worksheet context (role ACCOUNTADMIN, database SAARTHI, warehouse SAARTHI_AI_WH). These changes are authored and source-tested offline; none has been executed on Snowflake.

## A. Objects (run in this order)

| # | File | Why | Fixes |
|---|------|-----|-------|
| 1 | `dynamic_tables/04_scheme_eligibility.sql` | Dynamic table re-created (re-initialises); state schemes become `eligibility_unverified`, central needs a date-valid scheme coverage | CR1-08 |
| 2 | `procedures/evaluate_gates.sql` | Every gate now returns the ids it cites; threshold gates also cite supporting verified assertions | empty `gates[].evidence_ids` |
| 3 | `procedures/bind_patient.sql` | `role_type IN ('treating','coordinator')` in the care-team check | CR1-12 |
| 4 | `procedures/tools/01_get_patient_facts.sql`, `02_get_readiness.sql`, `03_search_patient_documents.sql`, `07_get_changes.sql` | shared preamble (role_type) | CR1-12 |
| 5 | `procedures/tools/06_get_timeline.sql` | full timeline field set, 200-row bound, total/truncated | CR1-01 |
| 6 | `procedures/tools/08_create_review_task.sql` | single MERGE in a transaction, open-task de-dup, role_type | CR1-05, CR1-06 |
| 7 | `procedures/extract_one_document.sql`, `procedures/validate_answer.sql` | shared preamble (role_type) | CR1-12 |
| 8 | `procedures/web_reads.sql` (2 procedures) | NULL-safe consent, schemes consent, document state, census clock, gate source spans, task read-back by id | CR1-03, 07, 10, 11, 12 + spans |
| 9 | `procedures/web_workflows.sql` | issue closes when last task resolves; role_type | CR1-19, 12 |
| 10 | `procedures/web_evidence.sql` | RECORD_WEB_ANSWER + PREPARE_WEB_PACKET (installed by nothing before) | CR1-02 |
| 11 | `tasks/reconcile_evidence.sql` | run ONLY the `CREATE OR REPLACE PROCEDURE ...reconcile_evidence_proc` statement (stop before `CREATE OR REPLACE TASK`, so the task graph is not disturbed) | CR1-09 |
| 12 | `tasks/orchestrator.sql` | run ONLY the `CREATE OR REPLACE PROCEDURE ...orchestrator_proc` statement (adds reconcile before readiness) | evidence links |
| 13 | `governance/03_grants.sql` | safety net: re-applies idempotent grants (FUTURE grants already cover replaced procedures/tables) | n/a |

Do not run the five untracked `procedures/web_accessible_patients|web_census|web_patient_context|web_review_tasks|web_scheme_eligibility.sql`
files: nothing calls them and they are marked NOT DEPLOYED (CR1-17).
`data/load_daycare_cohort.sql` changed (CR1-19) but need NOT be re-run; run it only when you want to re-anchor the relative-date cohort.

Equivalent scripted path where the CLI can connect: `node backend/scripts/deploy-web-integration.mjs` prints a hash; re-run with
`--apply --sha256 <hash>`. It installs steps 2, 5, 6, 8, 9, 10 only; steps 1, 3, 4, 7, 11, 12 still need Snowsight.

## B. Populate documents, assertions and evidence links (needed for document citations)

Live sweep showed `DOC-LAB-DC-01` with `assertion_count 0`, `missingness_state pending`: the pipeline never ran on the cohort PDFs.
Gates can cite events as soon as step 2 is deployed; they cite verified assertions and exact spans only after this section.

1. Generate document SQL (local, synthetic PDFs only):
   `./venv/bin/python -m backend.scripts.prepare_synthetic_documents data/generated/cohort_document_manifest.json data/generated/pdf/cohort /tmp/cohort_docs.sql`
   then run `/tmp/cohort_docs.sql` in Snowsight (DOCUMENT + DOC_PAGE rows).
2. `CALL SAARTHI.OPERATIONAL.chunk_documents_proc();`
3. `CALL SAARTHI.OPERATIONAL.extract_assertions_proc();` (bounded: 10 pages per call; repeat until it reports nothing pending; two model families, R7; spends Cortex credits)
4. `CALL SAARTHI.OPERATIONAL.reconcile_evidence_proc();`
5. `CALL SAARTHI.OPERATIONAL.refresh_readiness_proc();` (writes `READINESS_STATE.evidence_ids`)

## C. Verify (run as SAARTHI_APP / the app user; ACCESS_HISTORY lags up to 180 min, use QUERY_HISTORY for live)

```sql
-- every gate cites something it actually used (expect 0 rows with an empty array where evidence exists)
SELECT patient_id, rule_id, outcome, ARRAY_SIZE(evidence_ids) n FROM SAARTHI.OPERATIONAL.READINESS_STATE WHERE ARRAY_SIZE(evidence_ids)=0 ORDER BY 1,2;
-- document pipeline reached the evidence layer
SELECT COUNT(*) assertions, COUNT_IF(verification_status='verified') verified FROM SAARTHI.EVIDENCE.ASSERTION;
SELECT relation, COUNT(*) FROM SAARTHI.EVIDENCE.EVIDENCE_LINK GROUP BY 1;
-- new procedures exist
SHOW PROCEDURES LIKE 'RECORD_WEB_ANSWER' IN SCHEMA SAARTHI.OPERATIONAL;
SHOW PROCEDURES LIKE 'PREPARE_WEB_PACKET' IN SCHEMA SAARTHI.OPERATIONAL;
```
Then, from the running app: `evidence/qa/live-sweep-*.txt` style probe; expect `timeline[].value` empty only where `value_text` carries the result,
and `gates[].evidence_ids` non-empty wherever the rule had inputs. Gates for rules with no inputs (`no X evidence found`) legitimately stay empty.

Concurrency check for CR1-06 (needs two sessions): fire two `CREATE_REVIEW_TASK` calls with different keys for the same issue and action in parallel;
expect one row in REVIEW_TASK and one response with `idempotent_replay: true`. This cannot be proven offline.
