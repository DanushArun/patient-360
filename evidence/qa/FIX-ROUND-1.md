# Fix round 1

Date 2026-10-04. Inputs: QA-ROUND-1.md, CODE-REVIEW-ROUND-1.md, live-sweep-1/2. No git writes; everything is in the working tree.
SQL changes are source-tested only (offline contract tests), NOT executed on Snowflake: those items are "fixed-needs-snowflake-deploy" and follow DEPLOY-ROUND-1.md.

## Test results after the fixes
| Run | Result |
|-----|--------|
| `cd web && npm test` | 273 pass / 0 fail (was 270; +3) |
| `npm run typecheck` | 0 errors |
| `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | OK, 15 routes |
| `npm run test:e2e` (now in-repo runnable) | 40 pass / 0 fail (was 11 / 29 fail) |
| `./venv/bin/python -m pytest -q` | 335 pass / 0 fail / 14 skipped (was 302 / 8 fail / 14) |

Engineering checks on synthetic fixtures; not clinical validation.

## Live findings (a)(b)(c): RCA
**(a) `gates[].evidence_ids` empty (9-11 of ~12 gates per patient).** Trace: UI `gate.evidence_ids` <- `snapshotGate` (web/lib/patient.ts) <- `GET_WEB_PATIENT_DATA('snapshot')`
<- `READINESS_STATE.evidence_ids` <- `refresh_readiness_proc` MERGE <- `evaluate_gates`. Root causes, in order:
1. `evaluate_gates.sql` second pass (11 rule-id dispatched rules: identity, pathology, HER2, coverage, CrCl, bilirubin, surgical clearance, LVEF delta) hard-coded `'evidence_ids', ARRAY_CONSTRUCT()`. They could never cite anything. Only the ~2-3 concept-threshold gates returned `[event_id]`.
2. Even those cited only the structured event, never the verified document assertion behind it, because nothing read `EVIDENCE_LINK`.
3. `EVIDENCE_LINK 'supports'` rows are written only by `reconcile_evidence_proc`, which is a child TASK of extract. `orchestrator_proc` (the on-demand sweep) called parse/chunk/extract/refresh and skipped reconcile, so a sweep never created links.
4. Data state (live-sweep-2): cohort documents have `assertion_count 0`; the extract/verify pipeline had not run on them, so there were no assertions to cite.
5. No code produced `gate.source_spans`, although `gate-source-excerpt.tsx` requires it, so exact excerpts could never render.
Fix: second pass now fills `v_ev` per rule (ID_MAP map_ids, pathology/HER2 event ids, coverage_id, auth_id, creatinine/weight/bilirubin/AST/LVEF event ids, surgical assertion ids); threshold gates add supporting verified assertion ids; orchestrator calls reconcile before readiness; `snapshot` view returns `source_spans` (verified assertion, bound patient, exact range within the page) which the mapper passes through. A gate with no inputs ("no X evidence found") correctly stays empty.
Status: **fixed-needs-snowflake-deploy** (+ pipeline run, DEPLOY section B, for document-level citations).
**(b) `timeline[].value` empty 2-4 rows.** Cause: `get_timeline` returned only `value_num`; qualitative results (HER2 IHC, pathology) have `value_text`. Same as CR1-01. **fixed-needs-snowflake-deploy.**
**(c) evidence `answers`/`packets` empty arrays.** Two causes, one fixed: ANSWER_RUN/EVIDENCE_PACKET are only written by user action, so empty is correct on a fresh account (no loader seeds them, by design: synthetic history would be fabricated). The real defect: `RECORD_WEB_ANSWER` and `PREPARE_WEB_PACKET` were installed by no deploy path (CR1-02), and `askPatient` swallowed the failure (`history_saved=false`), so history could never fill. Packets also inherit `evidence_ids` from gates, which were empty (a). Also found: the three write paths (`createReviewTask`, `transitionReviewTask`, `prepareEvidencePacket`) never returned `read_back_confirmed`, which the UI requires, so every successful write displayed as "could not be confirmed"; `confirmWriteReceipt` existed and was tested but was wired into nothing. Now wired. **fixed-needs-snowflake-deploy** (procedures must exist).

## Per issue
| ID | RCA | Files | Verification | Status |
|----|-----|-------|--------------|--------|
| CR1-01 | see (b); timeline path emitted 8 fields, UI renders 17 | `backend/sql/procedures/tools/06_get_timeline.sql`, `web/lib/patient.ts` | `test_round1_fix_contracts.py::TimelineCarriesEveryRenderedField`; typecheck | fixed-needs-snowflake-deploy |
| CR1-02 | `setup.sql` never ran web_*.sql; patch script omitted web_evidence | `backend/sql/setup.sql`, `backend/scripts/deploy-web-integration.mjs` | `SetupDeploysEveryWebProcedure` incl. a scan that every `CALL SAARTHI.OPERATIONAL.X` in web/ resolves to a CREATE PROCEDURE reachable from setup.sql | fixed (setup.sql) / fixed-needs-snowflake-deploy (live account) |
| CR1-03 | `NOT ARRAY_CONTAINS(...)` is NULL on NULL categories, `IF(NULL)` skipped, fail-open | `web_reads.sql` (2 sites) | `ConsentFailsClosed` | fixed-needs-snowflake-deploy. NOT done: NOT NULL/default on `CONSENT.data_categories` (table DDL change, out of SPEC scope; the query is now safe without it) |
| CR1-04 | no origin check on /api/ask, /api/review-task | `web/app/api/ask/route.ts`, `review-task/route.ts` (+ evidence, review-tasks PATCH now use shared `isSameOrigin`) | `RoutesAreHardened` | fixed |
| CR1-05 | constant key `${issue}:${action}` replayed a resolved task as success | `web/lib/patient.ts`, `api-contracts.mjs` (+ `requestId` in body, already sent by client) , `08_create_review_task.sql` | `CreateTaskIsAtomic...` | fixed-needs-snowflake-deploy |
| CR1-06 | SELECT-then-INSERT race; UNIQUE not enforced | `08_create_review_task.sql` single MERGE in a transaction, open-task de-dup | contract test; concurrency not provable offline (DEPLOY section C) | fixed-needs-snowflake-deploy |
| CR1-07 | schemes view skipped financial consent | `web_reads.sql` (fail-closed; rows listed with status `financial_consent_required`, no limit/packages) | `ConsentFailsClosed` | fixed-needs-snowflake-deploy |
| CR1-08 | eligibility asserted from proxies | `dynamic_tables/04_scheme_eligibility.sql` | `ConsentFailsClosed::test_scheme_eligibility...` | fixed-needs-snowflake-deploy. Basis shown in UI: not done (UI prints the status code only) |
| CR1-09 | any two numeric reports became "discordant across specimens" | `tasks/reconcile_evidence.sql` (biomarker concepts only) | sqlite execution of the real SELECT incl. serial-Hb case | fixed-needs-snowflake-deploy. Consumer for the link (CR1-17 note, DOC-DISC-001 always pass) not built: not in SPEC scope |
| CR1-10 | census view had no gate clock; page showed load time | `web_reads.sql`, `web/lib/census.ts`, `web/app/page.tsx` ("Readiness as of <oldest known_as_of>") | `CensusCarriesItsOwnClock`; e2e | fixed-needs-snowflake-deploy |
| CR1-11 | "present" from any present assertion regardless of verification | `web_reads.sql` documents view | `DocumentStateIsVerified` | fixed-needs-snowflake-deploy |
| CR1-12 | exact vs case-folded user match; role_type only in some paths | Policy chosen: exact `snowflake_user = CURRENT_USER()` everywhere (matches AGENTS §3.1 and the live-proven bind) and `role_type IN ('treating','coordinator')` in bind_patient, the shared preamble in all tools/web procedures. Files: `bind_patient.sql`, `tools/01,02,03,06,07,08,_preamble`, `extract_one_document.sql`, `validate_answer.sql`, `web_reads.sql`, `web_workflows.sql`, `web_evidence.sql` | `AccessPolicyIsOneThing`, `check_gate` preamble drift test | fixed-needs-snowflake-deploy. Behaviour change: a practitioner whose login case differs from the stored row no longer appears in the picker either (consistent, not silently different) |
| CR1-13 | default account was the old one | `web/lib/snowflake-config.mjs`, test, README | `snowflake-config.test.mjs` | fixed for web. `tools/release_gate.py` + its test NOT changed: it validates the historical acceptance packet recorded on the old account; changing the constant without re-running acceptance would misstate evidence |
| CR1-14 | optional (`pat_expired` code) | n/a | n/a | not-fixed: optional hardening, no failing behaviour; current fail-closed identity check is sound |
| CR1-15 | raw error text in page.tsx and schemes route | `web/app/page.tsx`, `schemes/route.ts` now map to fixed codes via `apiError` | `test_route_failures_use_typed_codes...`, `RoutesAreHardened` | fixed |
| CR1-16 | evidence GET 403 for everything, POST 409 | `evidence/route.ts` | same | fixed |
| CR1-17 | five duplicate unwired procedures | Not deleted (untracked files you authored and `evidence/coco/snowflake-new-account-rca.md` links them; deletion is irreversible). Each now carries a NOT DEPLOYED banner; `setup.sql` and the patch script do not run them | grep: no caller | not-fixed by choice: your decision to delete |
| CR1-18 | upgrade script ran after a DROP/CREATE | removed from `setup.sql`, explained inline (standalone additive script) | `test_legacy_authorization_upgrade_is_not_a_noop_inside_setup` | fixed |
| CR1-19 | loader re-stamped `ingested_at`; resolve left issue `open` | `data/load_daycare_cohort.sql` (re-stamp only when event_time re-anchored); `web_workflows.sql` closes issue on last resolve | `LoaderKeepsIngestionClock`, `CreateTask...` | fixed-needs-snowflake-deploy. The `LEAST(..., now-3h)` clamp is kept: it exists to keep fixture labs out of the future |
| F-01 | fixture routes only installable in an outside checkout | new `web/tests/run-e2e.mjs`; `package.json` `test:e2e` runs it (raw runner kept as `test:e2e:raw`). It copies web/ (without node_modules, .next, snowflake.log, .env*) to a temp dir outside the repo, installs the five fixture routes, builds, runs Playwright, deletes the copy. Fixtures never enter the shipping app | 40/40 pass | fixed |
| F-02 | `streamlit_extras` missing | `requirements.txt` (+ installed in ./venv) | pytest 335 pass | fixed |
| F-03 | Playwright browser not preinstalled | documented: `npx playwright install chromium` (writes outside repo); `run-e2e.mjs` header | n/a | fixed (documented; cannot be vendored) |
| F-04 | schemes/timeline/evidence/review-tasks leaked raw text, no `purge_patient_state` | all routes on `apiError`/`apiErrorStatus`; `withPatientSession` rejects malformed ids | api-contracts tests | fixed |
| F-05 | pages returned 200 for any id | malformed ids -> 404 (`notFound`) on patient/history/navigator. Well-formed but unknown or unauthorised ids deliberately keep the same 200 error state: a different response would be an existence oracle (R5) | build | fixed (as designed) |
| F-06 | malformed JSON gave 502 | body parsed with `readJsonBody` before the upstream try; 400/413 | `RoutesAreHardened` | fixed |
| F-07 | `/design-preview/PAT-DC-04` hard-coded link | intentional recorded fixture entry shown only when live is unavailable; value is not clinical data from Snowflake and is labelled as a recorded preview | n/a | not-fixed by design (info) |

## Not verified / residual risk
- No SQL here was compiled or run on Snowflake. Highest-risk statements: the `gate_spans` CTE in `web_reads.sql` (comma-LATERAL FLATTEN followed by JOINs), `QUALIFY ... OR ...` in the LVEF evidence query, and MERGE lock behaviour under concurrent `CREATE_REVIEW_TASK`.
- Evidence ids mix record kinds (event ids, assertion ids, map/coverage/auth ids). Only assertion ids produce exact page spans; others are shown as ids.
- Pipeline numbers (assertions verified, links written) are unknown until DEPLOY section B is run; do not claim document citations before then.
- `web/lib/patient.ts` `createReviewTask` now requires the new `tasks` read-back (`web_reads.sql`); deploying the web without step 8 turns every task creation into `write_readback_unconfirmed`.
