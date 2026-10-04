# QA Round 4 (independent) - 2026-10-04

Scope: re-run gates, verify Round-3 fixes (N3-01..N3-07, D3-01, D3-02) from code, audit the Snowsight deploy bundle `backend/sql/deploy/00..09` + README as the human ACCOUNTADMIN deployer.
FIX-ROUND-3.md was used only as a pointer. No fixes made. No git writes. No credential files read. No SQL run against Snowflake. No POST/PATCH.
Everything in backend/sql is `unverified-needs-deploy`. Synthetic data; engineering checks, not clinical validation.

## 1. Gates (all re-run by me)

| Run | Result |
|-----|--------|
| `cd web && npm test` | **279 pass / 0 fail / 0 skipped** |
| `npm run typecheck` | **0 errors** |
| `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | **OK** (all routes built, no errors) |
| `npm run test:e2e` | **40 pass / 0 fail / 40 total** (20.9 s) |
| `./venv/bin/python -m pytest -q` | **366 pass / 14 skipped / 0 fail**, 36 subtests |
| `python -m backend.scripts.build_deploy_bundle --check` | **"deploy bundle is current (11 files)"** (also `test_deploy_bundle.py` 4/4) |
| Live GET sweep 127.0.0.1:3000 | **NOT POSSIBLE: nothing is listening on :3000** (all 37 requests returned connection refused, curl 000; `lsof` shows no listener). I did not start a server (it would open a Snowflake session). Item 4 of the task is unverified. |

## 2. Round-3 fixes

| ID | Verdict | Evidence |
|----|---------|----------|
| N3-01 timeline "Not received" for recorded events | **VERIFIED in source** | `06_get_timeline.sql:117-126`: non-present plausibility wins; value/text -> present; `ordered` -> pending; `cancelled` -> not_received; labelled event -> present; else `unreadable`. Columns exist: `ce.display`, `ce.code`, `ce.status` on CLINICAL_EVENT; `DT_HARMONIZED_EVENTS` has no `display/code/status/unit`, so `SELECT h.*, ce.*` has no duplicate-column clash. Concept label falls back to display/code. Runtime unproven. Residual (Low, N4-04): a `final` lab with a concept but no value and no text is labelled `present` and shows no value; honest only if the UI shows "-" next to "Present". |
| N3-04 labs vs timeline disagree | **VERIFIED** | `web_reads.sql:515-522` CASE is textually identical to 06 (with `h.`/`ce.` aliases); node test `test_timeline_and_labs_share_one_value_state_rule_in_sql` and the pytest equivalent pass. `web/lib/patient.ts:172` uses `deriveValueState` (valid state wins, else value/text, else `state_unavailable`). |
| N3-02 reference scope UI | **VERIFIED** | `workspace-patient-screen.tsx:276-277` option `reference` is `disabled` with "not available" text; `workspace-patient-copilot.tsx:32-35` `NON_RETRYABLE_ERRORS` + specific copy for `reference_scope_unavailable`; e2e asserts the disabled attribute and mocks the real 409 (`workspace-flow.spec.ts:97-119`). The 409 render path is source-tested only (cannot select a disabled option in e2e). |
| N3-03 error catalogue | **VERIFIED** | `api-contracts.mjs:54-57` has `readiness_refresh_unavailable`, `workspace_data_unavailable`, `record_service_unavailable`, `service_unavailable` -> `unavailable`; copy in copilot (lines 37-39). |
| N3-05 RAP aligned with procedures | **VERIFIED in source, with caveats** | `01_policies.sql:46-72` keys on `CURRENT_USER()` only (no `CURRENT_ROLE()` in the policy); adds `p.active`, `role_type IN ('treating','coordinator')`, `active_from <= CURRENT_DATE()`, `active_to >= CURRENT_DATE()`, matching `_preamble.sql:113-114`, `bind_patient.sql:35`, `web_reads.sql`. `PRACTITIONER.active`, `CARE_TEAM.role_type/active_from/active_to` exist. Attached to DOC_PAGE only (`02_attach_policies.sql`); DOC_CHUNK untouched (AGENTS 3.3/3.4 respected). Owner's-rights procedures still work because the policy evaluates `CURRENT_USER()`, the caller, and both seed files create the PRAC-01 care-team link for the deploying user. Caveats: see N4-02, N4-03. |
| N3-06 discordance links | **VERIFIED (doc only)** | IMPLEMENTATION-STATUS marks it designed-only; test exists. |
| N3-07 runner | **VERIFIED** | Not executed beyond reading; dry-run default, ACCOUNTADMIN needs `--allow-accountadmin`, no password auth (bundle README repeats this). |
| D3-01 plan counts / manifest | **VERIFIED** | Bundle README states 16 documents / 11 patients / 5 pathology; `cohort_documents.py --manifest` option and test exist; 6 stale PDFs still in the tree (not pruned; noted, harmless). |
| D3-02 DEEP-0001 source page | **VERIFIED in source** | `06_seed_data.sql:235-240` adds a labelled-synthetic one-page DOC_PAGE (char_count 263, test checks length equals text); seeded assertions reset to `unverified`/`pending` with NULL spans and R7 respected (no span claim without two-pass). The UPDATE is limited to `extractor_version='seed-v1'` so it cannot clobber pipeline-written rows. |

## 3. NEW findings

| ID | Sev | Finding | Location |
|----|-----|---------|----------|
| **N4-01** | **Medium (half-deploy / grants)** | In `05_tasks_and_grants.sql` the two `CREATE OR REPLACE TASK ... AFTER/ SCHEDULE` statements come BEFORE the grants. If the task graph root (`TASK_PARSE_DOCUMENTS`) is still started, `CREATE OR REPLACE TASK TASK_RECONCILE_EVIDENCE` (child of `TASK_EXTRACT_ASSERTIONS`) fails and Run all stops: the orchestrator task and all grants (`GRANT USAGE ON ALL PROCEDURES ... TO SAARTHI_APP`) are skipped. Steps 01-03 have already `CREATE OR REPLACE`d every web/tool procedure, which drops their grants unless FUTURE grants were in place; the web would then fail with "not authorized" until grants are re-run. The suspend step is only a commented line in 00_preflight. Also `GRANT USAGE ON AGENT SAARTHI_AGENT` / `MCP SERVER SAARTHI_MCP` at the end fail if those objects do not exist on the account (they are not created by the bundle), again leaving the last statements unrun. Re-running 05 after fixing the cause is safe. Suggest: grants first or separate file, make the suspend an executed statement. | `deploy/05_tasks_and_grants.sql:130,208, 244-262`; `00_preflight.sql:13` |
| **N4-02** | **Medium (idempotency under RAP)** | Step 04 attaches the RAP to DOC_PAGE before 06/07 run `MERGE INTO DOC_PAGE ... WHEN NOT MATCHED INSERT`. A MERGE target scan is filtered by the policy, so if the running user is not the user stored on PRAC-01 (PRAC-01 is created `WHEN NOT MATCHED` only; if it already exists with another `snowflake_user`, it is not updated), existing pages are invisible, the MERGE sees NOT MATCHED, and a **duplicate page row** is inserted on every re-run. README only warns about this for step 08. Same for 07 care-team on DC patients when the "skip cohort block" advice in preflight/07 is followed: no care-team link is created for the running user, and step 08 sees no pages. | `deploy/06_seed_data.sql:235`, `deploy/07_cohort_and_documents.sql:308+`, `README.md` caveats |
| N4-03 | Medium (needs deploy test) / pre-existing | RAP body uses `d.doc_id = doc_id` inside a subquery over `DOCUMENT d`: unqualified `doc_id` can bind to the inner table column (always true) instead of the policy argument. If so, the reference branch returns every row once any reference document exists, and the patient branch returns all DOC_PAGE rows for any user with any care-team link. Not introduced in Round 3 (git diff shows the lines are unchanged) and I cannot test it offline; nobody has recorded a cross-patient negative test for DOC_PAGE. Verify after step 04 by querying DOC_PAGE as a user not on a patient's care team. | `governance/01_policies.sql:49-69`, `deploy/04_governance_row_access.sql:34-60` |
| N4-04 | Low | See N3-01 residual: final event with a concept but no value reads "present" with no value. | `06_get_timeline.sql:124`, `web_reads.sql:521` |
| N4-05 | Low | Step 04 detaches the RAP then recreates it; if CREATE fails (e.g. syntax), Run all stops with DOC_PAGE **unprotected** by any policy until fixed. Exposure is limited (no role other than owner has table SELECT) but it is a fail-open window; README does not say "if 04 fails, re-run before anything else". | `deploy/04_governance_row_access.sql:12-34` |
| N4-06 | Low | Bundle does not install, and preflight does not check for, procedures the web and step 08 depend on: `BIND_PATIENT` is in 02, but `RELEASE_PATIENT_BINDING`, `ASK_SAARTHI`, `PARSE_DOCUMENTS_PROC`, `CHUNK_DOCUMENTS_PROC`, `EXTRACT_ASSERTIONS_PROC`, `REFRESH_READINESS_PROC` are assumed already live from earlier rounds and are not verified to match the repo (`tasks/extract_assertions.sql` pins the same models, but the deployed copy is unproven). Add a `SHOW PROCEDURES` existence check to 00. | `deploy/00_preflight.sql`, `deploy/08_pipeline_kickoff.sql` |
| N4-07 | Info | `extract_assertions.sql:104` pass B reuses `v_prompt_a`; harmless. Both passes pinned, `temperature: 0`, `llama3.3-70b` (Meta) vs `claude-haiku-4-5` (Anthropic), `max_tokens 1800`; no `orchestration: auto`. Same in `extract_one_document.sql:103,107` (bundled in 03). R7 / AGENTS 3.8 satisfied. `saarthi_agent.sql` pins `claude-opus-5` (not in bundle). |

No High-severity defect found. No new test failures.

## 4. Bundle audit

Regenerated from repo SQL: `--check` current, setup.sql forbidden in the generator (`build_deploy_bundle.py:36`). No `PUT`, `!set`, `!source`, `&var` anywhere. Every file starts `USE ROLE ACCOUNTADMIN; USE SECONDARY ROLES NONE; USE DATABASE SAARTHI; USE WAREHOUSE SAARTHI_AI_WH;` (AGENTS 3.2). No `DROP TABLE`, `TRUNCATE`, `DELETE`, or `CREATE OR REPLACE TABLE` on data tables. The only non-procedure replaces are `DT_SCHEME_ELIGIBILITY` (derived, FULL refresh, no AI function), the two tasks, the RAP, and TEMPORARY tables `_DC_COHORT/_DC_EVENTS`. Only `DROP` is the RAP detach (wrapped in `EXECUTE IMMEDIATE $$ ... EXCEPTION $$`). Seeds are MERGE `WHEN NOT MATCHED` (a few `WHEN MATCHED UPDATE` on concept_id / re-anchoring of schedule and event times, no deletes). Procedure bodies are `$$`-wrapped (valid for Snowsight Run all). `SET dc_anchor` and temp tables rely on one session (fine within one worksheet). Dependency order is sound: web procs (01) -> gates/bind/DT (02) -> tool procs (03) -> RAP (04) -> reconcile/orchestrator/tasks/grants (05) -> seed (06) -> cohort/docs (07) -> pipeline (08) -> verify (09). Procedures reference later objects only at call time. Tasks are recreated suspended; no task is resumed by the bundle (the re-enable in 08 is commented, a deliberate manual step). Grants: `SAARTHI_APP` receives USAGE on database, schemas and procedures in OPERATIONAL, no table SELECT, no search-service USAGE (matches AGENTS 3.3/3.5). The web needs no warehouse grant in the bundle; assumed pre-existing.

| File | Verdict | Notes |
|------|---------|-------|
| 00_preflight | PASS (read-only) | Suspend of TASK_PARSE_DOCUMENTS is commented, not executed (N4-01). No procedure existence check (N4-06). |
| 01_web_procedures | PASS | 6 procedures, idempotent replace. Failure midway leaves old+new mix; re-run safe. |
| 02_gates_and_scheme_table | PASS | DT replace re-initialises (data derived). Re-run safe. |
| 03_tool_procedures | PASS | 10 procedures. Re-run safe. |
| 04_governance_row_access | **CAUTION** | N4-03, N4-05. Re-run safe. |
| 05_tasks_and_grants | **CAUTION** | N4-01 ordering; partial failure leaves procs ungranted. Re-run safe after cause fixed. |
| 06_seed_data | **CAUTION** | N4-02 duplicate DOC_PAGE on re-run if run by another user. Otherwise idempotent. |
| 07_cohort_and_documents | **CAUTION** | N4-02; cohort block skip-advice conflicts with README on care-team link; document day anchoring caveat (README). |
| 08_pipeline_kickoff | PASS with manual steps | Run statement by statement; CALLs spend Cortex credits; depends on deployed copies of pipeline procedures (N4-06) and RAP visibility. |
| 09_verify | PASS (read-only) | Invariant queries correct against the schema (R7). |

**Verdict: safe to run in order as ACCOUNTADMIN with the following preconditions: suspend `TASK_PARSE_DOCUMENTS` first (executed, not commented), run steps 06/07/08 as the user stored on PRAC-01, and confirm the AGENT/MCP SERVER objects exist (or expect the last two grant statements to fail). No data is dropped; no blocking defect; every step is re-runnable except for the duplicate-page risk in N4-02 under a different user.**

## 5. Unverified, needs deploy (ordered)

1. Step 04: RAP recreate + attach; then a negative cross-patient DOC_PAGE test and a positive owner's-rights call (N4-03).
2. Step 01-03: all procedures compile and run (scripting column errors surface at CALL time only).
3. Step 02: `DT_SCHEME_ELIGIBILITY` `refresh_mode = FULL`.
4. Step 05: tasks created suspended, grants present (`SHOW GRANTS TO ROLE SAARTHI_APP`), AGENT/MCP grants succeed.
5. Step 06/07: counts 16 docs / 11 patients, no duplicate DOC_PAGE rows (`GROUP BY doc_id, page_index HAVING COUNT(*)>1` should be empty).
6. Step 08: two-pass extraction outcomes, `supports` link count, readiness evidence ids (numbers depend on model output; criterion is the R7 invariant).
7. App after restart: timeline shows PAT-DC-01 diagnosis as "Present" (N3-01), labs/timeline agree (N3-04), reference scope disabled (N3-02), documents sub-pages 404 on bad id; live :3000 was down so nothing was confirmed live.
8. `read_back_confirmed`, concurrent review-task MERGE, Round-2 UI fixes live.
