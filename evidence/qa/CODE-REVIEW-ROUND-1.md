# Code review, round 1

Date: 2026-10-04. Scope: working-tree diff, web/app, web/lib, web/components, backend/sql (web_*.sql, tasks, tables, governance, data loaders).
Method: static read of the code. `npm test` in web/ gave 270 pass, 0 fail. The two Python SQL-contract test files gave 17 pass. These are offline source checks, not Snowflake execution, so nothing below was run against a live account.
Every item cites the lines it was read from. No source files were edited.

Counts: 3 blocker/high, 9 med, 7 low (19 total).

## Blocker / High

### CR1-01 | high | web/lib/patient.ts:109-127 vs backend/sql/procedures/tools/06_get_timeline.sql:106-112
Defect: `loadPatientTimeline` keeps only 8 fields, and the SQL `get_timeline` only emits those same 8 (concept, value, is_derived, 3 clocks, event_id). `web/app/patient/[id]/patient-timeline.tsx:17-58` renders `unit`, `value_text`, `value_state`, `abnormal_flag`, `derivation`, `valid_until`, `source_document_ids`, `source_assertion_ids`, `source_event_ids` and `total_events/truncated/provenance_observed_at`. None of these are ever populated.
Failure scenario: A qualitative result (HER2 IHC, pathology) has `value_num` NULL, so the row shows only the concept name with no value. This is a missingness-as-blank R3 violation. Numeric rows read "5.2 " with no unit. The "Document backed" filter is always empty, "No linked document" matches every row, and no "Open document" links ever appear. Citations from the timeline are therefore not demonstrable.
Fix: Have the timeline path read the `labs` fact view, which already builds all of these fields (web_reads.sql:453-487). Alternatively extend `get_timeline` and the mapper to carry the fields, and add a LIMIT with `total_events`/`truncated`. Also read the plausibility state, so rejected or unreadable values are not shown as present.

### CR1-02 | high | backend/sql/setup.sql (whole file); backend/scripts/deploy-web-integration.mjs:6
Defect: `setup.sql` never executes any of `procedures/web_*.sql` (grep for `web_` in setup.sql is empty). That means GET_WEB_WORKSPACE, GET_WEB_PATIENT_DATA, UPDATE_WEB_REVIEW_TASK, REFRESH_BOUND_READINESS, RECORD_WEB_ANSWER and PREPARE_WEB_PACKET are absent after a clean `setup.sql` deploy. The patch script `deploy-web-integration.mjs` installs only web_reads.sql, web_workflows.sql and 08_create_review_task.sql, so `web_evidence.sql` is installed by nothing. The five new `get_web_*` files (accessible_patients, census, patient_context, review_tasks, scheme_eligibility) are installed by nothing.
Failure scenario: A judge redeploys from the repo and every page fails with `procedure does not exist`. On the existing account, `askPatient` swallows the missing RECORD_WEB_ANSWER error (patient.ts:261 `catch { history_saved=false }`), so answer history silently never persists. `PREPARE_WEB_PACKET` fails with 409.
Fix: Add all web procedures to step 14 of setup.sql and to the patch script file list. Add a test that asserts every `CALL ...OPERATIONAL.<name>` in web/ resolves to a CREATE PROCEDURE reachable from setup.sql.

### CR1-03 | high | backend/sql/procedures/web_reads.sql:575-577 and 523-526 (coverage domains)
Defect: The financial-consent gate is `IF (NOT ARRAY_CONTAINS('financial'::VARIANT, (SELECT data_categories FROM CONSENT WHERE consent_id=:v_consent_id)))`. If `data_categories` is NULL, or the consent subquery returns no row, `ARRAY_CONTAINS` returns NULL. `NOT NULL` is NULL, and Snowflake Scripting treats `IF (NULL)` as false, so the guard is skipped and the data is returned. This is fail-open, contrary to AGENTS §3.10. It applies to `coverage_comparison` and to `facts` with domain `coverage`.
Failure scenario: A consent row is inserted with NULL data_categories (the column is nullable, 10_governance.sql:74). The practitioner then reads authorization and coverage financials without a financial grant.
Fix: Use `IF (COALESCE(ARRAY_CONTAINS(...), FALSE) = FALSE)`, or select a boolean with `COALESCE(...,FALSE)` first. Add NOT NULL or a default on `data_categories`.

## Medium

### CR1-04 | med | web/app/api/ask/route.ts:3-15 and web/app/api/review-task/route.ts:3-23
Defect: Both state-changing POST routes have no `isSameOrigin` or Origin check. The patient POST, the evidence POST and the review-tasks PATCH do have one. `/api/ask` also writes ANSWER_RUN through RECORD_WEB_ANSWER, and `/api/review-task` inserts REVIEW_TASK rows.
Failure scenario: Any web page open in the operator's browser can `fetch('http://127.0.0.1:3000/api/review-task', {method:'POST', body: JSON.stringify({patientId, ruleId, action:'escalate'})})` with `text/plain`, which avoids preflight, and `request.json()` parses it. A cross-site write then lands under the single app identity.
Fix: Apply the same `isSameOrigin` guard as the other routes. Validate the id formats of `patientId`, `ruleId` and `question` length (the evidence route caps question at 4000).

### CR1-05 | med | web/lib/patient.ts:293 and 293-310 (createReviewTask)
Defect: The idempotency key is the constant `${issueId}:${action}`. 08_create_review_task.sql:152-160 returns `idempotent_replay` for any prior row with that key.
Failure scenario: A coordinator requests a document and the task is later resolved. If the gate still fails, a second "Request document" click returns the old, resolved task with `idempotent_replay:true`. No new task is created, and the UI shows success.
Fix: Include a client-generated per-click UUID, as `PATCH` already does with requestId. Keep a deterministic key only for open-task de-duplication, and check task state.

### CR1-06 | med | backend/sql/procedures/tools/08_create_review_task.sql:152-168 and web_workflows.sql:111-123 (race on idempotency)
Defect: Idempotency is a SELECT-then-INSERT against `REVIEW_TASK.idempotency_key`. The `UNIQUE` declared at 50_operational.sql:86 is not enforced by Snowflake. 08_create_review_task.sql runs the check and the insert with no transaction or lock.
Failure scenario: A double-click on "Escalate" sends two concurrent requests on separate sessions. Both pass the SELECT and both insert, producing duplicate open tasks. UPDATE_WEB_REVIEW_TASK is protected by the version bump, but the create path is not.
Fix: Use `MERGE ... ON idempotency_key WHEN NOT MATCHED INSERT` inside a transaction, then re-read by key. Alternatively serialize through a REVIEW_ISSUE row update.

### CR1-07 | med | backend/sql/procedures/web_reads.sql (GET_WEB_PATIENT_DATA 'schemes', line ~311) and web_scheme_eligibility.sql
Defect: The `schemes` view returns DT_SCHEME_ELIGIBILITY without the financial-consent check that `coverage_comparison` and `facts coverage` enforce. Scheme status derives from COVERAGE rows (04_scheme_eligibility.sql:23-33).
Failure scenario: A patient who consented to clinical access only still has coverage-derived status ("eligible", per-scheme limit) shown in the Navigator.
Fix: Apply the same `data_categories` check, fail-closed (see CR1-03). Alternatively document that scheme eligibility is classed as clinical access.

### CR1-08 | med | backend/sql/dynamic_tables/04_scheme_eligibility.sql:23-33
Defect: Eligibility is asserted from proxies. A central scheme gives `'eligible'` whenever any COVERAGE row has `payer_type='scheme'`. A state scheme gives `'eligible'` on domicile alone, with no income or SECC test, and an expired or inactive coverage still counts.
Failure scenario: The Navigator tells a family their patient is "eligible" for a scheme with an income ceiling that was never evaluated. That overclaims against R1/R3 (an unevaluated state should be `pending` or not_evaluated).
Fix: Output `eligibility_unverified` / `income_or_seccc_uncertain` for anything not evidenced. Show the basis in the UI. Include coverage validity dates in the check.

### CR1-09 | med | backend/sql/tasks/reconcile_evidence.sql:44-70
Defect: The new cross-specimen link pairs any two verified `present` assertions with the same `concept_id` and unit, different value, different documents, and different non-empty `accession_id`. Nothing restricts it to specimen-bearing (pathology or biomarker) concepts. Serial labs (Hb 10.1 then 11.2 on different dates) satisfy every condition. The Python test (test_document_sql_contracts.py) only covers qualitative rows, not serial numerics.
Failure scenario: Every analyte with two reports gets `discordant_across_specimens` links, which implies a clinical discordance that is only a trend.
Fix: Restrict to ontology concepts flagged as specimen-bound (HER2, ER/PR, Ki-67 and similar), or require the same effective date window. Also note nothing reads the new relation: evaluate_gates.sql:285-298 DOC-DISC-001 always returns pass from CLINICAL_EVENT specimens, so this link is a write with no consumer (see CR1-17).

### CR1-10 | med | web/lib/census.ts:11-27 and web_reads.sql:117-143 ('census' view) + web/app/page.tsx:55-57
Defect: The census SQL does not select `rs.known_as_of` or `computed_at`. `ReadinessRow` has no such field. The workspace bar's "known as of" is `Refreshed <browser clock time>`, which is the page load time and not the data's clock. (`queue_readiness` at web_reads.sql:76-77 does expose `known_as_of`.)
Failure scenario: Readiness computed days ago is displayed as "Refreshed 10:42" and every row shows as current. This breaks R2 ("every answer carries known_as_of").
Fix: Select and render `MIN(known_as_of)` per visit and as the page-level value, and label staleness.

### CR1-11 | med | backend/sql/procedures/web_reads.sql:379-381 ('documents' missingness)
Defect: `CASE WHEN conflicting_assertions>0 THEN 'conflicting' WHEN present_assertions>0 THEN 'present' ELSE 'pending' END`. `present_assertions` counts `missingness_state='present'` regardless of `verification_status`. A single-pass or `unverified` assertion therefore makes the document "present". Meanwhile a document whose assertions are all unreadable, explicitly_negative or superseded shows `pending`.
Failure scenario: A document with one unverified (single_pass) value shows as present. This violates R7 (a value is never asserted from one unverified read). A document with an unreadable page is shown as "pending" instead of `unreadable`.
Fix: Derive from verification status plus the seven-state column: `present` only when verified, then `unreadable`/`superseded`/`explicitly_negative` according to the assertion states. Also state plainly when a document has no extraction yet.

### CR1-12 | med | backend/sql/procedures/web_reads.sql:186-199 (preamble) vs bind_patient.sql:23 and the picker/census queries
Defect: The preamble resolves the practitioner with `snowflake_user = CURRENT_USER()` (exact case), as do bind_patient.sql:23 and tools/_preamble.sql:101. The picker, census and queue views (web_reads.sql:11-18, new web_accessible_patients.sql:17, web_census.sql:24) use `UPPER(...) = UPPER(...)`. Also, bind_patient and the preamble do not restrict `role_type`, while the picker/census/owners/UPDATE restrict to treating or coordinator. The new `get_web_*` procedures do not restrict role_type at all.
Failure scenario: A practitioner row stored in a different case from the login name appears in the picker and census, but opening the patient fails with `no_patient_access`. A `patient_navigator` or `consulting` member is excluded from the picker, but can bind by direct URL `/patient/<id>` and read documents and gates.
Fix: Pick one comparison (UPPER both sides) and one role policy, and apply it to bind_patient and the shared preamble. Add a test.

## Low

### CR1-13 | low | web/lib/snowflake-config.mjs:15-21; web/lib/snowflake-config.mjs default account
Defect: The default allowed account is still the old `KGTPGHJ-YJ28449`, while README.md says OS69400 is the live account. The allowlist is read from the same environment as `SNOWFLAKE_ACCOUNT`, so setting both defeats it. It is a typo guard, not a security control. `tools/release_gate.py:9` also hard-codes the old account.
Failure scenario: A new environment must set a second variable to connect to the intended account. The old account's name stays embedded in code, so a stale environment connects to the old account without error.
Fix: Source the allowed account from one committed config value for the current account, and remove the old name. Update `release_gate.py` and its test.

### CR1-14 | low | web/lib/snowflake.ts:41-62
Defect: `USE SECONDARY ROLES NONE` failure with code 3107 is tolerated and then verified by a SELECT. That verification is sound. Remaining gaps: it checks only `CURRENT_ROLE()` and secondary roles, so a PAT whose role has been granted more than SAARTHI_APP-inherited privileges is not detected (for example, SAARTHI_APP also granted to ACCOUNTADMIN-reachable roles). A PAT file is also read per connection without an expiry hint, so an expired token surfaces as an opaque connect error.
Fix: Optional. Surface a specific `pat_expired` code. State in the docs that the role must be exactly SAARTHI_APP.

### CR1-15 | low | web/app/page.tsx:34-37 and web/app/api/patient/[id]/schemes/route.ts:15-21
Defect: Raw `error.message` strings are shown in the UI (page.tsx) and returned in JSON (schemes route, `{error: msg}` when the message contains "access"). Driver messages can include SQL fragments or account identifiers. Also `snowflake_access_disabled` contains "access" and so maps to HTTP 403 instead of a 5xx.
Fix: Map to a fixed code set via `apiError`, as the other routes do.

### CR1-16 | low | web/app/api/patient/[id]/evidence/route.ts:7-8
Defect: GET returns 403 for every failure including Snowflake outages. POST returns 409 for everything.
Failure scenario: A transient outage is shown as "access withdrawn".
Fix: Use `apiError`/`apiErrorStatus`.

### CR1-17 | low | backend/sql/procedures/web_accessible_patients.sql, web_census.sql, web_patient_context.sql, web_review_tasks.sql, web_scheme_eligibility.sql (all new, untracked)
Defect: Dead code. Nothing in web/ calls any `get_web_*` lowercase procedure, and none is in setup.sql or the deploy script (see CR1-02). Their logic duplicates the web_reads.sql views and has already diverged: no role_type filter, a different CONSENT scope, and `web_scheme_eligibility` inherits CR1-07. `web_patient_context` lacks the `access_withdrawn` binding release. AGENTS §6 says not to add features not in SPEC.md.
Fix: Delete them, or wire them in and remove the duplicate views. Do not keep two unsynchronised authorization implementations.

### CR1-18 | low | backend/sql/data/upgrade_legacy_authorization.sql and setup.sql:92
Defect: It runs immediately after `20_core.sql`, which does `DROP TABLE IF EXISTS SAARTHI.CORE.AUTHORIZATION` and recreates it with the current columns, so the ALTER and UPDATE are a no-op in the setup.sql flow. The UPDATE can only run if the script is executed standalone.
Fix: Remove it from setup.sql, or move it before the DROP. Note also that 20_core.sql drops CORE.PATIENT/ENCOUNTER/COVERAGE on every setup run (pre-existing). That is data loss on re-run, and the scripts do not say so.

### CR1-19 | low | backend/sql/data/load_daycare_cohort.sql:272-278 and web_workflows.sql:105-112
Defect (loader): `WHEN MATCHED THEN UPDATE SET t.ingested_at = CURRENT_TIMESTAMP()` re-stamps `ingested_at` on every reload. That rewrites the R2 clock for existing events, so a `known_as_of` before the reload no longer sees events it previously could. The `LEAST(..., now-3h)` clamp also silently moves labs scheduled "today" earlier.
Defect (workflow): a resolve changes REVIEW_TASK.state to `resolved` but never REVIEW_ISSUE.state, which stays `open`. REVIEW_ISSUE has a CHECK on state; REVIEW_TASK has none.
Fix: Do not update `ingested_at` on MATCHED rows (or document the fixture as non-historical). Keep issue and task states consistent.

## Loader coverage vs. UI (what can actually be populated)

- Documents list and `document` page text: populated by the parse pipeline (30_documents), not by the SQL loaders. Cohort PDFs exist under data/generated/pdf/cohort and the new `cohort_document_manifest.json`. The loader to DOC_PAGE is `prepare_synthetic_documents.py` plus the pipeline, and I did not run it. Evidence spans (`char_start/char_end`) therefore exist only for pipeline-extracted assertions. The seeded `ASS-WOUND-01` / `ASS-INFECT-01` / `ASS-CLEAR-01` (load_synthetic.sql:209-228) are now `pending/unverified` with NULL value and no spans on a document that has no DOC_PAGE row. That is correct for R7, but it means SURG-CLEAR-001 for PAT-DEEP-0001 can never pass until a real page is ingested, and the demo patient shows `not_evaluated`.
- Timeline: the SQL-side fields cannot satisfy the UI (CR1-01).
- Schemes: SCHEME_REGISTRY has 3 rows (load_synthetic.sql:240-254), and DT covers central plus state-scoped rows. Patients whose `state` is not TN or MH show only the central scheme.
- Review tasks: no loader seeds REVIEW_TASK or REVIEW_ISSUE except one HER2 issue (load_synthetic.sql:487). Task history is empty until created through the UI, so the empty state must be right (Unassigned and blank cases are handled by `?? "Unassigned"`).
- Coverage comparison: needs a financial consent. Cohort consents include `financial` (load_daycare_cohort.sql:65). The PAT-DEEP-0001 consent should be checked against the same.

## Verified OK (no defect found)

- Role pinned to `SAARTHI_APP` regardless of `SNOWFLAKE_ROLE`; covered by tests (snowflake-config.test.mjs:25-71).
- No tool or web procedure takes a `patient_id`; scope is taken from the session binding (the preamble) or `CURRENT_USER()`.
- RAP and the procedures key on `CURRENT_USER()`; no `CURRENT_ROLE()` in the web procedures.
- `document` view: the doc_id|known_as_of parsing is validated and bounded; future cutoffs are rejected.
- The numeric `supports` link now requires matching unit, status and patient (web_reads.sql:466-479 plus reconcile_evidence.sql).
