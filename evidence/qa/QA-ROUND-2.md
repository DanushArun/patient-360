# QA Round 2 (independent) — 2026-10-04

Scope: re-run Round 1, verify every FIX-ROUND-1 claim from the diff (FIX-ROUND-1.md not trusted), regression hunt, static SQL review, deploy-plan review, live read-only sweep.
No fixes, no git writes, no credential files read, no POST/PATCH to live routes. Snowflake SQL could not be executed here: those items are labelled `unverified-needs-deploy`.
Engineering checks on synthetic data; not clinical validation.

## 1. Test run table (all re-run by me)

| # | Run | Round 1 | Round 2 |
|---|-----|---------|---------|
| 1 | `cd web && npm test` | 270 pass / 0 fail | **273 pass / 0 fail / 0 skipped** |
| 2 | `npm run typecheck` | 0 errors | **0 errors** |
| 3 | `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | 15 routes | **OK, 15 routes (8 pages + 7 API groups listed), no test-* fixture routes in output** |
| 4 | `npm run test:e2e` (now `node tests/run-e2e.mjs`) | 11 pass / 29 fail | **40 pass / 0 fail / 40 total** (21.7 s; isolated temp copy, no leftover temp dir found) |
| 5 | `./venv/bin/python -m pytest -q` (repo root) | 302 pass / 8 fail / 14 skip | **335 pass / 0 fail / 14 skipped / 36 subtests pass** |
| 6 | `prepare_synthetic_documents` generator (read-only, output to scratchpad) | n/a | runs, 19.5 KB SQL produced (see D-02) |
| 7 | Live GET sweep, 3 patients x 12 routes + `/` + `/review-queue` | n/a (offline) | 38/38 return as expected: 36 x 200, 2 x 403 (PAT-DEEP-0001 coverage views, `consent_not_valid`, correct fail-closed) |

Side effect to know: my `npm run build` rewrote `web/.next`. The running `next-server` (PID 87229, started 2:28PM, serving OLD code) kept answering 200 afterwards, but restart it before relying on it.

## 2. FIX-ROUND-1 claims, verified independently

Legend: VERIFIED = code read + test run (web/JS) ; SQL-reviewed = read against backend/sql/tables/*.sql, `unverified-needs-deploy`.

| ID | Claim | Verdict | Notes |
|----|-------|---------|-------|
| F-01 e2e in-repo runnable | VERIFIED | `npm run test:e2e` 40/40. `web/app` contains no test-* route; `run-e2e.mjs` copies to os tmpdir, skips node_modules/.next/snowflake.log/.env*, symlinks node_modules, deletes copy. Fixtures do not leak into shipping app or build output. |
| F-02 streamlit_extras | VERIFIED | requirements.txt has it; pytest 335/0 fail. |
| F-03 playwright browser | VERIFIED (documented only) | |
| F-04 typed errors, purge flag | VERIFIED in code + unit tests; NOT visible live (old server) | schemes/timeline/evidence/review-tasks all on `apiError`. Live still returns `{"error":"bind failed: no_patient_access"}` (old code running). |
| F-05 malformed id -> 404 | VERIFIED in code (patient/history/navigator `notFound()`), NOT live. Residual N-04: documents sub-page not covered. |
| F-06 malformed JSON 400 | VERIFIED in code/tests; live still 502 (old server). |
| CR1-04 origin check | VERIFIED in code (`isSameOrigin` on ask, review-task, evidence POST, review-tasks PATCH). Live /api/ask with `Origin: http://evil.com` returned 400 not 403 because the live server is old code. |
| CR1-15/16 | VERIFIED in code. |
| CR1-13 account default | VERIFIED (snowflake-config + test). `tools/release_gate.py` deliberately still old account (agree). |
| CR1-18 | VERIFIED (upgrade script no longer run from setup.sql). |
| Wiring of `read_back_confirmed` | VERIFIED in code: `confirmWriteReceipt` now used by `createReviewTask`, `transitionReviewTask`, `prepareEvidencePacket`; consumers `task-actions.tsx:38`, `evidence-history.tsx:156`, `patient-task-idempotency.mjs:84` require `read_back_confirmed === true`. Works only after step 8 deploy (see N-03, N-05). |
| requestId plumbing (CR1-05) | VERIFIED: UI `crypto.randomUUID()` -> body -> `validateReviewTaskBody` regex `^[A-Za-z0-9-]{8,80}$` (UUID passes) -> `createReviewTask` key. |
| CR1-01 timeline 17 fields | SQL-reviewed: 17 keys emitted by `06_get_timeline.sql` (concept, value, value_text, unit, abnormal_flag, value_state, is_derived, derivation, valid_until, event_time, source_recorded_at, ingested_at, event_id, source_event_ids, source_assertion_ids, source_document_ids, source_links_observed_at) = mapper in `patient.ts:160-178` = `TimelineEvent` type. Columns used (plausibility_state, value_text, abnormal_flag, is_derived, derivation in DT_HARMONIZED_EVENTS; unit/status from CLINICAL_EVENT) all exist; no `unit` collision with `h.*`. `unverified-needs-deploy`. Regression N-01 below. |
| (a) gate evidence_ids | SQL-reviewed. All referenced columns exist (ID_MAP.map_id, COVERAGE.coverage_id, AUTHORIZATION.auth_id, CLINICAL_EVENT.event_id, DT_HARMONIZED_EVENTS.concept_name/event_time, ASSERTION.subject/predicate). `unverified-needs-deploy`. Live (old procedure): PAT-DC-01 5/15 gates cite ids, DC-07 3/12, DEEP-0001 5/16 (unchanged from Round 1). |
| source_spans contract | SQL-reviewed against `gate-source-excerpt.tsx` validator: all required keys present with matching names; `known_as_of` format matches gate clock; excerpt length math is consistent (`char_end <= LENGTH(text)` guard). `unverified-needs-deploy`. |
| CR1-03/07 consent fail closed | SQL-reviewed: `COALESCE(ARRAY_CONTAINS(...),FALSE)=FALSE` at 2 sites, schemes view masks to `financial_consent_required`. Live (old proc) coverage views for PAT-DEEP-0001 return `consent_not_valid` (correct). |
| CR1-08 scheme eligibility | SQL-reviewed; columns exist. Risk: `CURRENT_DATE()` inside a CASE in a DYNAMIC TABLE select list (REFRESH_MODE = AUTO should fall back to FULL, but unverified). `unverified-needs-deploy`. |
| CR1-09 reconcile | SQL-reviewed: biomarker join valid (`concept_type` CHECK includes 'biomarker'; ontology rows HER2_IHC/HER2_FISH are biomarker). `target_type 'clinical_event'` written by reconcile matches `evaluate_gates` reader. |
| CR1-06 atomic create | SQL-reviewed: single MERGE in explicit transaction, EXCEPTION ROLLBACK+RAISE. Concurrency unprovable offline. `unverified-needs-deploy`. |
| CR1-10 census clock | Code VERIFIED; SQL `known_as_of`/`computed_at` added to census. See N-02 for degradation. |
| CR1-11 document state | SQL-reviewed. |
| CR1-12 policy | VERIFIED by grep: every file containing the preamble now has `role_type IN ('treating','coordinator')`; no `UPPER(...snowflake_user)` / `UPPER(CURRENT_USER())` remains in procedures/ or tools/ (the 5 untracked NOT-DEPLOYED files excluded). Seed data stores `snowflake_user = CURRENT_USER()` (load_synthetic.sql:31) so exact match holds for the practitioner picker; a hand-seeded mixed-case row would vanish (documented in FIX). No CURRENT_ROLE() misuse found. |
| CR1-19 | SQL-reviewed. `IFF(t.event_time = s.event_time, ...)` in UPDATE SET reads the pre-update value (correct in Snowflake). Issue-close UPDATE is guarded by patient_id and `ACTION='resolve'`. |
| CR1-02 setup.sql / deploy script | Code VERIFIED: setup.sql runs web_reads/web_workflows/web_evidence after tools; every `CALL SAARTHI.OPERATIONAL.X` in web/ (19 distinct) resolves to a CREATE PROCEDURE in backend/sql (checked by grep, including ASK_SAARTHI, CLASSIFY_QUESTION, COHORT_QUERY, GET_CHANGES, RELEASE_PATIENT_BINDING, SEARCH_REFERENCE_DOCUMENTS). |
| CR1-14, CR1-17, F-07 | not-fixed by design, agree. |

## 3. NEW failures

| ID | Sev | Finding | Repro / evidence | Expected vs actual | Suspects |
|----|-----|---------|------------------|--------------------|----------|
| N-01 | Medium (R3) | Mapper defaults a missing `value_state` to `"not_received"`, so against the currently deployed `GET_TIMELINE` (no `value_state`) every row that HAS a numeric value is rendered "· not_received". | Live PAT-DC-01 timeline row: `{"concept":"T_SCORE","value":-0.8,...}` has no value_state; `patient.ts:167` turns that into `not_received`; `patient-timeline.tsx:28` prints it. Not re-created live only because the live server is old code, but the shape and the code path are both confirmed. | Expected: absent state derived from the value (`present` if value or value_text) or shown as unknown. Actual: "not received" next to a value, which is the exact R3 inversion AGENTS.md forbids. Also happens on any frontend-before-SQL deploy ordering. | `web/lib/patient.ts:167` |
| N-02 | Low | Census header says "No readiness computed yet" whenever rows lack `KNOWN_AS_OF`, i.e. also against the old census procedure although readiness exists. Graceful but false text until step 8 is deployed. | `web/app/page.tsx` `censusClock`, `lib/census.ts:107-115`. Live `/` is 200 (old code, shows old label). | Expected: distinguish "field absent" from "nothing computed". | `web/app/page.tsx:93-98` |
| N-03 | Medium | Write read-back requires the NEW `tasks` view (`task_id=:ARGUMENT` branch). Deploying the web before DEPLOY step 8 makes every `transitionReviewTask` succeed in Snowflake but report `write_readback_unconfirmed` (409). Documented in FIX-ROUND-1 residual risk but there is no guard in code or in the deploy order warning. | `patient.ts:134-143` reads `GET_WEB_PATIENT_DATA('tasks', <taskId>)`; deployed view matches only issue/rule id. | Deploy plan should state "step 8 before restarting web". | `web/lib/patient.ts:126-143`, `web_reads.sql:339-342` |
| N-04 | Low | F-05 not applied to the document sub-page; malformed ids still render a 200 shell there. | `web/app/patient/[id]/documents/[doc]/page.tsx` not in diff. | Expected 404 like sibling pages. | that file |
| N-05 | Low | `packets` view uses `LIMIT 50` with no ORDER BY; the new write read-back (`PACKET_ID === receipt.packet_id`) can miss the just-written packet for a patient with >50 packets and report "unconfirmed". | `web_reads.sql:376-381`, `patient.ts:370-376` | Expected ORDER BY delivered_at DESC (or look up by id). | |
| N-06 | Low | `/api/review-task` now maps any non-catalogued procedure error (e.g. `task_transition_requires_review`) to `action_unavailable`, losing detail the old route passed through. | `review-task/route.ts` `{...result, ...failure}` | Cosmetic; UI may only show a generic message. | |
| N-07 | Info (pre-existing) | `/api/ask` validates `sourceScope` ('patient'|'reference') then drops it; `askPatient(patientId, question)` has no scope parameter, so a UI scope selector is inert (R6 relevance). | `lib/api-contracts.mjs:61-67`, `lib/patient.ts:334` | Verify the UI does not imply a reference-corpus search. | |
| N-08 | Info | `web/lib/snowflake.ts` / `snowflake-config.mjs` gained PAT auth + session-scope verification (`CURRENT_ROLE()='SAARTHI_APP'`, secondary roles none) which FIX-ROUND-1 does not mention. Reads fail closed and tests pass (`snowflake-session.test.mjs`, untracked). Live app works with it (inferred: live server may be pre-change). | `web/lib/snowflake.ts:19-62` | Untracked/undocumented change; needs review by owner. | |
| N-09 | Info | `data/generated/pdf/cohort/*` and `cohort_events.json` show as modified (regenerated, timestamps embedded). Noise for any commit; not reviewed for content. | `git status` | | |

### Deploy-plan defects (DEPLOY-ROUND-1.md)

| ID | Sev | Finding |
|----|-----|---------|
| D-01 | Low | Dependency order is otherwise consistent: DT(1) -> gates(2) -> bind/tools(3-7) -> web_reads(8) -> web_workflows(9) -> web_evidence(10) -> reconcile proc(11) -> orchestrator proc(12, calls reconcile) -> grants(13). Every web-called procedure is installed by some step; the 5 untracked web_*.sql files are correctly excluded. The scripted path installs only 2,5,6,8,9,10 as stated. |
| D-02 | **High (plan not executable as written)** | Section B step 1 says to run the generated `/tmp/cohort_docs.sql` in Snowsight. I generated it: it contains `PUT 'file:///Users/.../DOC-LAB-DC-01' @SAARTHI.STAGES.PATIENT_DOCS/...` lines. `PUT` cannot run in a Snowsight worksheet (needs SnowSQL/driver, which the plan says is blocked by the network policy), and the paths are hard-coded to this laptop. Files must instead be uploaded through the Snowsight stage UI, or the PUT lines dropped (the DOC_PAGE text rows are inserted directly anyway). Stage must be SNOWFLAKE_SSE (AGENTS §3.7); plan does not say so. |
| D-03 | Low | `data/load_synthetic.sql` was changed (seed SURG assertions now `unverified`, plus a repair UPDATE for existing deployments) but it is not in the deploy list. Until it is re-run, live PAT-DEEP-0001 keeps seeded `verified` assertions that were never read by two models, so SURG-CLEAR-001 can still pass on fixture values. Consequence of re-running: SURG-CLEAR-001 for DEEP-0001 will flip from pass to not-evaluated, which is intended but changes the demo. |
| D-04 | Low | Step 11/12 instruct partial-file execution ("run ONLY the CREATE PROCEDURE statement"); error-prone by hand (both files also contain `CREATE OR REPLACE TASK`, which resets a task). Prefer splitting files or giving exact line ranges (reconcile_evidence.sql:13-120, orchestrator.sql:29-70). |

## 4. Static SQL risks (all `unverified-needs-deploy`)

1. `web_reads.sql` `gate_spans` CTE: `JOIN ranked_encounters e ON ... , LATERAL FLATTEN(input => rs.evidence_ids) f JOIN ASSERTION a ON a.assertion_id = f.value::VARCHAR ...` mixes explicit JOIN, comma-LATERAL and a following JOIN. Likely valid, but the highest syntax risk in the set. If it fails, GET_WEB_PATIENT_DATA('snapshot') fails and the whole patient overview breaks (not just spans). Suggest deploying step 8 first and calling snapshot before anything else.
2. `evaluate_gates.sql` SURV-LVEF-002: `QUALIFY ROW_NUMBER() OVER (...) = 1 OR ROW_NUMBER() OVER (...) = 1` (two windows in one QUALIFY with OR) - valid in Snowflake as far as I know, unverified; ties on event_time return extra ids.
3. `web_reads.sql` schemes branch: `LET v_scheme_fin BOOLEAN := ...` declared inside an `ELSEIF` branch of a scripting block; LET inside IF branches is normally allowed but unverified.
4. `04_scheme_eligibility.sql`: `CURRENT_DATE()` in a dynamic-table projection (refresh mode AUTO).
5. `08_create_review_task.sql`: MERGE `ON a OR (b AND c)` plus explicit transaction inside an EXECUTE AS OWNER procedure with an EXCEPTION block (same pattern already used in web_workflows). Replay response does not re-check actor for the dedup (open-task) match; replay across practitioners of the same patient returns the other person's task_id (low).
6. Column/table-name check against tables/*.sql: no mismatches found in evaluate_gates, 06_get_timeline, web_reads (assertion/doc/doc_page/readiness_state/clinical_event/coverage columns), reconcile_evidence, 04_scheme_eligibility, 08_create_review_task.
7. Fail-open scan: none found in the changed SQL. All `NOT ARRAY_CONTAINS` sites are NULL-safe now. R5: no CURRENT_ROLE() used for scoping; exact CURRENT_USER() everywhere.
8. Idempotency: all changed objects are CREATE OR REPLACE or MERGE; `load_synthetic.sql` UPDATE repair is re-runnable. No non-idempotent DDL introduced.

## 5. Live read-only sweep (dev server 127.0.0.1:3000, OLD code + OLD procedures)

- The server answers all routes for PAT-DC-01, PAT-DC-07, PAT-DEEP-0001 (api patient, evidence, timeline, schemes, workspace documents/facts labs/facts coverage/coverage_comparison, review-tasks?ruleId=ID-LINK-001, and pages /patient, /history, /navigator, /, /review-queue). Latency 4.4-9.5 s per call.
- DEEP-0001 coverage views: 403 `{"error":"consent_not_valid","category":"access","purge_patient_state":false}` (no financial consent; correct).
- The server is NOT running the Round 1 fixes: `/api/patient/BAD/schemes` -> 403 `bind failed: no_patient_access`; `/api/ask` malformed JSON -> 502; foreign `Origin` -> 400 (not 403); `/patient/BAD!` -> 200. So no frontend fix can be confirmed live; they are confirmed by unit tests, build and e2e only. Restart required.
- Graceful degradation (new web code vs old procedures) by code reading and old-shape live payloads: gate `source_spans` absent -> "An exact source excerpt was not returned for this check." (OK); `evidence_ids` empty -> shown empty (OK); census without `KNOWN_AS_OF` -> misleading text (N-02); timeline without `value_state` -> mislabelled (N-01); task/packet write read-back -> "unconfirmed" until step 8 (N-03). No crash paths found.
- Live data snapshot (old procedures): PAT-DC-01 15 gates, 5 with evidence_ids; DC-07 12/3; DEEP-0001 16/5. Timeline `value` empty 2/2/4 rows (qualitative; fix pending deploy). Documents all `pending` (pipeline never run, matches FIX note). Schemes payload still present for all three.

## 6. Remains unverified-needs-deploy

Everything in backend/sql: evaluate_gates evidence ids, source_spans, 06 timeline 17 fields, web_reads (consent, schemes, document state, census clock, tasks-by-id, spans), web_workflows issue close, web_evidence install, reconcile_evidence, orchestrator, 04_scheme_eligibility, 08 MERGE/concurrency, bind/preamble role_type + exact CURRENT_USER (picker behaviour), load_daycare_cohort ingested_at, load_synthetic repair; pipeline numbers (assertions verified, links written); document-level citations; `read_back_confirmed` end-to-end against real Snowflake.

## 7. Verdict

Offline gates are green and the claimed fixes are real in code (JS/TS and SQL source). Blockers before relying on them: deploy (D-02 PUT problem), restart the web server, and fix N-01 (R3 mislabel) before any frontend-before-SQL ordering. No new High defect in application code.
