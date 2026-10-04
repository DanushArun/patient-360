# Deploy plan, round 2 (run by a human in Snowsight as ACCOUNTADMIN)

**This file supersedes `evidence/qa/DEPLOY-ROUND-1.md`.** Round 1 is kept for history only: its section B used `PUT`
(cannot run in Snowsight) and its steps 11/12 asked for partial-file runs (D-02, D-04 in QA-ROUND-2). Do not follow it.

Nothing here has been executed on Snowflake: every SQL item is source-tested offline only (`unverified-needs-deploy`).
Synthetic data only. Engineering checks are not clinical validation.

Context for every worksheet: role `ACCOUNTADMIN`, `USE SECONDARY ROLES NONE;`, database `SAARTHI`, warehouse `SAARTHI_AI_WH`.
Paths are relative to `backend/sql/`. Do NOT run `setup.sql` (its `tables/20_core.sql` drops CORE.PATIENT, ID_MAP,
ENCOUNTER, COVERAGE, AUTHORIZATION). Each file below is whole-file runnable ("Run all") and idempotent.

## Pre-deploy checklist
- [ ] The change set is the working tree you tested: `cd web && npm test && npm run typecheck` and `./venv/bin/python -m pytest -q` are green.
- [ ] You can open Snowsight as ACCOUNTADMIN and `SELECT CURRENT_ROLE(), CURRENT_SECONDARY_ROLES();` shows the role you expect.
- [ ] Stage encryption (AGENTS.md section 3.7): `DESC STAGE SAARTHI.STAGES.PATIENT_DOCS;` shows `TYPE = SNOWFLAKE_SSE`.
      If it does not, recreate it: `CREATE OR REPLACE STAGE SAARTHI.STAGES.PATIENT_DOCS ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE') DIRECTORY = (ENABLE = TRUE);` then `GRANT READ, WRITE ON STAGE SAARTHI.STAGES.PATIENT_DOCS TO ROLE SAARTHI_APP;`
- [ ] Task state recorded before touching task files: `SHOW TASKS IN SCHEMA SAARTHI.OPERATIONAL;` Note which are `started`.
      If `TASK_PARSE_DOCUMENTS` (root of the document graph) is `started`, run `ALTER TASK SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS SUSPEND;` before step 8.
- [ ] Baseline counts saved (compare after): run the "Post-deploy verification" queries once now.
- [ ] Generated document SQL exists (step 11, local, needs only Python and the repo).
- [ ] The running web server is left alone until step 14; the new web code needs the new procedures (see order below).

## A. Objects (run in this order, whole files)

Order rationale: web_reads first, because the new web code reads through it (QA N-03: write read-back needs the new `tasks` view);
smoke-test it immediately because the `snapshot` view is the highest syntax risk.

| # | File | Why |
|---|------|-----|
| 1 | `procedures/web_reads.sql` (2 procedures) | consent fail-closed, census clock, source spans (now `gate_cites` CTE), tasks by id, packets by id and ordered |
| 2 | `procedures/web_workflows.sql` | issue closes when last task resolves; role_type |
| 3 | `procedures/web_evidence.sql` | RECORD_WEB_ANSWER, PREPARE_WEB_PACKET |
| 4 | `dynamic_tables/04_scheme_eligibility.sql` | dynamic table re-created, now `REFRESH_MODE = FULL`, LEFT JOIN instead of correlated EXISTS |
| 5 | `procedures/evaluate_gates.sql` | gates return the ids they cite (LVEF query rewritten, no OR over two windows) |
| 6 | `procedures/bind_patient.sql` | role_type in the care-team check |
| 7 | `procedures/tools/01_get_patient_facts.sql`, `02_get_readiness.sql`, `03_search_patient_documents.sql`, `06_get_timeline.sql`, `07_get_changes.sql`, `08_create_review_task.sql` | shared preamble, 17-field timeline, atomic task create |
| 8 | `procedures/extract_one_document.sql`, `procedures/validate_answer.sql` | shared preamble |
| 9 | `tasks/reconcile_evidence.sql` (whole file: procedure + `TASK_RECONCILE_EVIDENCE`) | evidence links. The task is re-created **suspended**. |
| 10 | `tasks/orchestrator.sql` (whole file: procedure + `TASK_SAARTHI_ORCHESTRATOR`) | sweep calls reconcile before readiness. The task is re-created **suspended**; it is used on demand via `CALL`, leave it suspended unless you want the 30-minute schedule. |
| 10b | `governance/03_grants.sql` | idempotent grant safety net |

After step 1, before anything else, smoke-test the read procedures as ACCOUNTADMIN is not possible for patient views (they bind on the caller),
so run the check in step 14 from the app. If step 1 fails to compile, stop: the whole patient overview depends on it.

After steps 9 and 10: if `TASK_PARSE_DOCUMENTS` was `started` in the checklist, re-enable the graph:
`SELECT SYSTEM$TASK_DEPENDENTS_ENABLE('SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS');`. If it was suspended, leave it.

Do not run the five untracked `procedures/web_accessible_patients|web_census|web_patient_context|web_review_tasks|web_scheme_eligibility.sql`
files (NOT DEPLOYED, nothing calls them).

Scripted alternative for steps 1-3 and 5, 7: `node backend/scripts/deploy-web-integration.mjs` (hash-gated, needs the SITAR key-pair path the script
was written for). It does not cover the rest; use the Snowsight path.

## B. Seed data and documents (no PUT anywhere)

11. **Generate pure SQL locally** (synthetic PDFs only, no credentials, no network):
    `./venv/bin/python -m backend.scripts.prepare_synthetic_documents data/generated/cohort_document_manifest.json data/generated/pdf/cohort cohort_docs.sql`
    Output: ALTERs + `MERGE INTO DOCUMENT` and `MERGE INTO DOC_PAGE` (page text inline), 36 statements for the 22-file cohort, no file paths.
12. **Seed reference data (D-03)**: run `data/load_synthetic.sql` as a whole file. It re-labels the seeded DEEP-0001 surgical assertions `unverified`
    (so SURG-CLEAR-001 for PAT-DEEP-0001 flips from pass to `not_evaluated` until two model passes verify them; intended, changes the demo).
    Note: its practitioner row uses `CURRENT_USER()`, i.e. the Snowsight user running it. If the web app logs in as a different user, `UPDATE SAARTHI.GOVERNANCE.PRACTITIONER SET snowflake_user = '<app user>' WHERE practitioner_id = 'PRAC-01';` (exact case, AGENTS.md section 3.1).
13. **Load documents**: paste `cohort_docs.sql` into a Snowsight worksheet and Run all.
    - Optional, only if you want the original PDFs on the stage: Snowsight, Data, Databases, SAARTHI, STAGES, PATIENT_DOCS, "+ Files", upload each file into folder
      `<patient_id>/` (e.g. `PAT-DC-04/DOC-LAB-DC-04`). Stage must be SNOWFLAKE_SSE (checklist). The pipeline does not need them: `DOCUMENT.source_path` already records `<patient>/<doc>`, so the parse task treats each as ingested.
    - Alternative without Snowsight (single script, you supply the connection at run time; never stored): 
      `SNOWFLAKE_ACCOUNT=<org-account> SNOWFLAKE_USER=<user> SNOWFLAKE_PASSWORD=<...> node backend/scripts/run-sql-from-env.mjs --apply backend/sql/data/load_synthetic.sql cohort_docs.sql`
      (also accepts `SNOWFLAKE_PAT` or `SNOWFLAKE_PRIVATE_KEY_PATH`; default is a dry run without `--apply`). A network policy that blocks your IP blocks this too.
14. **Restart the web server** (it serves stale code from an earlier build) and open one patient. Then run, one at a time, in a worksheet: `CALL SAARTHI.OPERATIONAL.chunk_documents_proc();`
    `CALL SAARTHI.OPERATIONAL.extract_assertions_proc();` (10 pages per call, repeat until nothing pending; two model families (R7); spends Cortex credits)
    `CALL SAARTHI.OPERATIONAL.reconcile_evidence_proc();` `CALL SAARTHI.OPERATIONAL.refresh_readiness_proc();`

## Post-deploy verification (worksheet, ACCOUNTADMIN; `QUERY_HISTORY` is live, `ACCESS_HISTORY` lags up to 180 min)

```sql
-- 1. objects exist
SHOW PROCEDURES IN SCHEMA SAARTHI.OPERATIONAL;           -- expect GET_WEB_PATIENT_DATA, GET_WEB_WORKSPACE, RECORD_WEB_ANSWER, PREPARE_WEB_PACKET, UPDATE_WEB_REVIEW_TASK
SHOW DYNAMIC TABLES LIKE 'DT_SCHEME_ELIGIBILITY' IN SCHEMA SAARTHI.OPERATIONAL;  -- refresh_mode = FULL
-- 2. documents per patient (expect 22 rows across the 12 cohort patients after step 13)
SELECT patient_id, COUNT(*) AS documents, COUNT_IF(status = 'active') AS active FROM SAARTHI.DOCUMENTS.DOCUMENT GROUP BY 1 ORDER BY 1;
SELECT COUNT(*) AS pages, COUNT_IF(char_count > 0) AS non_empty FROM SAARTHI.DOCUMENTS.DOC_PAGE;
-- 3. assertions by verification status (R7: only 'verified' may drive a gate)
SELECT verification_status, missingness_state, COUNT(*) AS n FROM SAARTHI.EVIDENCE.ASSERTION GROUP BY 1, 2 ORDER BY 1, 2;
SELECT relation, COUNT(*) AS n FROM SAARTHI.EVIDENCE.EVIDENCE_LINK GROUP BY 1;
-- 4. gates with non-empty evidence_ids per patient (gates with no inputs legitimately stay empty)
SELECT patient_id, COUNT(*) AS gates, COUNT_IF(ARRAY_SIZE(evidence_ids) > 0) AS with_evidence,
       COUNT_IF(ARRAY_SIZE(evidence_ids) = 0) AS empty
  FROM SAARTHI.OPERATIONAL.READINESS_STATE GROUP BY 1 ORDER BY 1;
SELECT patient_id, rule_id, outcome, reason FROM SAARTHI.OPERATIONAL.READINESS_STATE
 WHERE ARRAY_SIZE(evidence_ids) = 0 ORDER BY 1, 2;        -- inspect: reasons should say "no ... evidence found"
-- 5. seeded assertions no longer verified without two passes
SELECT verification_status, COUNT(*) FROM SAARTHI.EVIDENCE.ASSERTION WHERE subject = 'PAT-DEEP-0001' GROUP BY 1;
```
From the app (restarted, as a care-team user): `/patient/PAT-DC-01` loads; timeline rows show "Present" next to values (never "Not received" beside a value);
a review task create/transition reports "saved" (read-back confirmed); census header shows "Readiness as of ...".
Concurrency check for CR1-06 (two sessions, same issue and action, different keys) expects one REVIEW_TASK row and one `idempotent_replay: true`; not provable offline.

## Rollback
Every object is `CREATE OR REPLACE`; to roll back re-run the previous version of the file from git history (read-only `git show`). Data MERGEs are insert-only
for documents; the `load_synthetic.sql` repair UPDATE is the only row rewrite (`unverified` is the safe direction).
