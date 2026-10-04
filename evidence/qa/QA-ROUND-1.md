# QA Round 1 (offline) — 2026-10-04

Live Snowflake unreachable (network policy); nothing live was attempted. No fixes made, no git writes.
Note: the dev server on 127.0.0.1:3000 was already running; its Snowflake mode was not inspected. All page/API probes below were against it.

## Test run table

| # | Run | Result | Counts |
|---|-----|--------|--------|
| 1 | `cd web && npm test` (node --test lib/*.test.mjs) | PASS | 270 pass / 0 fail / 0 skipped |
| 2 | `npm run typecheck` | PASS | 0 errors |
| 3 | `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | PASS | 15 routes (8 pages, 7+1 API incl. ask, review-task) built |
| 4 | `SAARTHI_SNOWFLAKE_ENABLED=false npm run test:e2e` (after `npx playwright install chromium`; first run without browser = 40/40 fail, env only) | FAIL | 11 pass / 29 fail / 40 total |
| 5 | `source venv/bin/activate && pytest -q` (repo root) | FAIL | 302 pass / 8 fail / 14 skipped / 36 subtests pass |
| 6 | SQL contract tests (backend/tests/test_document_sql_contracts.py, backend/tests/sql/*) | PASS (inside run 5, no failures there) | part of 302 |
| 7 | HTTP probe of pages: /, /review-queue, /patient/BAD, /history/BAD, /navigator/BAD, /design-preview/BAD, /patient/BAD/documents/X | PASS-with-notes | 7/7 return 200 (see F-05) |
| 8 | HTTP probe of API GETs with bad id: /api/patient/BAD, /evidence, /schemes, /timeline, /workspace (no params), /review-tasks | PARTIAL | 6/6 returned 4xx, none 5xx; inconsistent shapes (F-04) |
| 9 | HTTP probe of POST /api/ask and /api/review-task: empty body, malformed JSON, clinical question | PARTIAL | 6/6 returned 4xx/5xx without crash; malformed JSON gives 502 (F-06) |
| 10 | SQL-injection-style id `' OR 1=1` on /workspace | PASS | 400 invalid_argument |
| 11 | Static check R5 `CURRENT_USER()` vs `CURRENT_ROLE()` in web_*.sql | PASS | CURRENT_ROLE appears only in comments (5); CURRENT_USER in 26 places |

NOT RUN (cannot be, offline): any live Snowflake read, per-tab rendering with real data, column-by-column display vs live procedure output, R2/R3/R4/R6/R7 runtime behaviour, tab-by-tab UI walk for patient workspace (Overview, Facts, Documents, Coverage, Family, Timeline, Answers). Page routes SSR only a loading shell; real content is client-rendered from APIs that need Snowflake, so UI panels were not inspectable without the e2e fixtures (see F-01).

## Failures

### F-01 (High, harness) — 29/40 e2e tests fail: fixture routes not installed
- Repro: `cd web && SAARTHI_SNOWFLAKE_ENABLED=false npm run test:e2e`
- Expected: spec suite runs against fixture pages. Actual: tests that `goto('/test-daycare')`, `/test-workspace/[id]`, `/test-source`, `/test-history/[id]`, `/test-queue` get the Next 404 ("This page could not be found"); e.g. authorized-patient-search.spec.ts:6 waits for "Select patient" button; workspace-recovery.spec.ts:124 cannot find heading "Fatima Begum".
- Cause: web/tests/prepare-fixtures.mjs only installs fixtures into an isolated checkout outside the repo (it throws otherwise), and playwright.config.ts / package.json do not do this. So the documented `npm run test:e2e` cannot pass in-repo. Not verified whether passing in an isolated checkout (did not do it; out of scope).
- Suspects: web/playwright.config.ts:34-46 (webServer, no fixture step), web/tests/prepare-fixtures.mjs:7-10, web/package.json:11.
- Failing specs (29): authorized-patient-search x4; storyboard-visual x1; visit-table x3; workspace-accessibility x5; workspace-documents x3; workspace-facts x3; workspace-flow x3; workspace-recovery x7. Passing 11 are specs not using fixture routes (list not itemised by runner output).
- Because of this, UI field/contract behaviour covered by those specs is UNVERIFIED this round.

### F-02 (Medium, pre-existing env) — 8 Streamlit frontend tests fail: missing `streamlit_extras`
- Repro: `source venv/bin/activate && pytest -q frontend/tests/test_streamlit_app.py`
- Expected: pass. Actual: ModuleNotFoundError: No module named 'streamlit_extras' at frontend/streamlit_app.py:50 (`from streamlit_extras.metric_cards import style_metric_cards`).
- Suspects: requirements.txt:7 lists `streamlit` but not `streamlit-extras`; venv lacks it. Tests failing: test_app_runs_offline_without_exception, test_chat_input_absent_until_a_patient_is_bound, test_binding_the_demo_patient_enables_input_and_resets_state, test_clear_conversation_resets_turns_and_selection, test_two_rules_sharing_one_gate_category_do_not_crash_on_render, test_home_offline_shows_recorded_census_without_open_buttons, test_family_checklist_view_renders_for_a_bound_patient, test_offline_notice_renders_through_the_design_system_not_a_raw_alert.

### F-03 (Low) — Playwright browser not installed by default
- Repro: fresh `npm run test:e2e` -> "Executable doesn't exist ... chromium_headless_shell-1243". I installed it to proceed (`npx playwright install chromium`, writes outside repo to ~/Library/Caches).

### F-04 (Medium) — Inconsistent error contract across patient API routes
- Repro: `curl -i http://127.0.0.1:3000/api/patient/BAD/schemes` and `/timeline` -> 403 `{"error":"bind failed: no_patient_access"}`; `/api/patient/BAD` -> 403 `{"error":"no_patient_access","category":"access","purge_patient_state":true}`; `/evidence` -> 403 `{"error":"evidence_history_unavailable"}`.
- Expected: all routes use apiError()/apiErrorStatus() shape (error code, category, purge_patient_state) so the client purges patient state on access loss. Actual: schemes and timeline emit raw exception text (`bind failed: ...`) with no `purge_patient_state`, leaking internal wording; evidence masks the access cause.
- Suspects: web/app/api/patient/[id]/schemes/route.ts:20-21; timeline/route.ts (same pattern, not line-checked); evidence/route.ts.

### F-05 (Low) — Invalid/non-existent patient ids return 200 shell on patient, history, navigator pages
- Repro: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/patient/BAD` -> 200 (loading shell; error only after client fetch). design-preview correctly 404s for unknown id (design-preview/[id]/page.tsx:11) but /patient/ID, /history/ID, /navigator/ID do not validate server-side. Expected per project intent is graceful error state; not verified client-side offline. `/patient/` (trailing slash) -> 308 then /patient 404 (acceptable).

### F-06 (Low) — Malformed JSON POST yields 502 not 400
- Repro: `curl -X POST -H 'content-type: application/json' -d '{bad' http://127.0.0.1:3000/api/ask` -> 502 `agent_unreachable`; same for /api/review-task -> 502 `action_unavailable`. Expected 400 invalid_argument (a client error). Empty `{}` correctly gives 400.
- Suspects: web/app/api/ask/route.ts and web/app/api/review-task/route.ts JSON parsing inside the try block that maps to upstream-failure codes.

### F-07 (Info) — Hard-coded patient id in UI
- web/app/page.tsx:84 and web/components/route-loading.tsx:18 link to `/design-preview/PAT-DC-04` (recorded synthetic preview; intentional fallback, but not sourced from Snowflake). No hard-coded confidence percentages found (R/AGENTS §5 OK). `patient_id` does not appear in /api/ask route or api-contracts.mjs (agent schema rule 5 OK on static grep).

## Pass notes
- web_*.sql: 8 procedures present (web_accessible_patients, web_census, web_evidence, web_patient_context, web_reads, web_review_tasks, web_scheme_eligibility, web_workflows); the first five of those plus web_review_tasks/web_scheme_eligibility are untracked/new and untested live.
- Column-by-column UI vs procedure field mapping was NOT completed (no live output; only unit tests in lib/*.test.mjs, which pass, cover normalizers).
