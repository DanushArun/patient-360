# Fix round 2 (2026-10-04)

Inputs: QA-ROUND-2.md, FIX-ROUND-1.md, DEPLOY-ROUND-1.md. No git writes; all changes are in the working tree. No credential file read.
SQL changes are source-tested offline only (`fixed-needs-snowflake-deploy`); follow `evidence/qa/DEPLOY-ROUND-2.md`, which **supersedes** DEPLOY-ROUND-1.md.
Engineering checks on synthetic fixtures, not clinical validation.

## Test results
| Run | Result |
|-----|--------|
| `cd web && npm test` | 276 pass / 0 fail (was 273; +3) |
| `npm run typecheck` | 0 errors |
| `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | OK |
| `npm run test:e2e` | 40 pass / 0 fail |
| `./venv/bin/python -m pytest -q` | 351 pass / 0 fail / 14 skipped (was 335; +16 incl. new `backend/tests/test_round2_fix_contracts.py`) |

## Per ID
| ID | RCA | Files | Verification | Status |
|----|-----|-------|--------------|--------|
| D-02 (High) | Round 1 section B ran generator output containing `PUT 'file:///Users/...'` lines: PUT is a SnowSQL/driver command, not runnable in Snowsight, and paths were machine-specific. The generator existed to feed PUT, but the pipeline does not need the file: DOC_PAGE text is inserted directly and `DOCUMENT.source_path` already equals the parse task's dedup key. Fix: generator emits pure-SQL MERGEs by default (`--with-put` kept as opt-in for SnowSQL users); backslash escaping added to `literal()` (Snowflake treats `\` as an escape in single quotes); optional PDF upload documented via the Snowsight stage UI into a SNOWFLAKE_SSE stage (AGENTS 3.7) with a `DESC STAGE` pre-check; new `backend/scripts/run-sql-from-env.mjs` runs files with connection details only from env vars at run time (PAT / key path / password), dry run unless `--apply`, nothing embedded or printed. | `backend/scripts/prepare_synthetic_documents.py`, `backend/scripts/run-sql-from-env.mjs`, `evidence/qa/DEPLOY-ROUND-2.md` | `test_synthetic_document_ingestion.py` (default has no PUT/file:// /paths; escape test), `DeployPlanIsExecutableInSnowsight`; generator run on real cohort: 36 statements, no PUT, no backslash problem; runner dry run parses it. Not run against Snowflake. | fixed (plan), needs-snowflake-deploy |
| D-03 | `load_synthetic.sql` changed but missing from the plan. | DEPLOY-ROUND-2 step 12 (incl. PRAC-01 `CURRENT_USER()` caveat and the intended SURG-CLEAR-001 flip) | plan test | fixed |
| D-04 | Steps 11/12 asked for partial-file runs. Both files also contain `CREATE OR REPLACE TASK`. Chosen: whole-file runs plus explicit task handling (record `SHOW TASKS`, suspend root `TASK_PARSE_DOCUMENTS` first if started, tasks are re-created suspended, re-enable with `SYSTEM$TASK_DEPENDENTS_ENABLE` only if it was started). | DEPLOY-ROUND-2 steps 9-10 | plan test forbids "run ONLY the" | fixed |
| N-01 (R3) | `patient.ts` defaulted a missing `value_state` to `not_received`, so old procedures labelled rows that carry values as not received. New pure `deriveValueState`: a valid state passes through; else `present` if a value or text exists, else `state_unavailable` (rendered "State unavailable"). Timeline view now uses `factStateLabel`. | `web/lib/workspace-patient-facts.mjs`, `web/lib/patient.ts`, `web/app/patient/[id]/patient-timeline.tsx` | unit test, render test (+1), source test | fixed |
| N-02 | Census label conflated "no clock field" with "nothing computed". New `censusClockLabel(error, asOf, loadedAt, rowCount)`: rows without a clock say "Readiness clock not reported by the server". | `web/lib/census.ts`, `web/app/page.tsx` | source test, build | fixed |
| N-03 | Write read-back needs the new `tasks`-by-id view; no guard. Order now puts `web_reads.sql` first and says restart web afterwards. Code: a read-back failure now shows a specific message ("sent but could not be read back, so it may be saved ... read procedures may not be at the latest version") in both task paths instead of a generic receipt error; `write_readback_*` codes mapped in `REVIEW_ERRORS` (the old key `write_unconfirmed` never matched a real code). | `web/components/task-actions.tsx`, `web/components/use-patient-review-task.ts`, DEPLOY-ROUND-2 | source test; not exercised against live | fixed (degrades clearly) |
| N-04 | Document sub-page missed F-05. | `web/app/patient/[id]/documents/[doc]/page.tsx` (`notFound()` on malformed id) | source test, build | fixed |
| N-05 | `packets` view `LIMIT 50` with no ORDER BY; read-back could miss the new packet. View now orders `delivered_at DESC, packet_id` and accepts the packet id as ARGUMENT; `prepareEvidencePacket` reads back by id. | `backend/sql/procedures/web_reads.sql`, `web/lib/patient.ts` | source test | fixed-needs-snowflake-deploy |
| N-06 | Route mapped unknown procedure errors to `action_unavailable`. Real codes the procedures return (`task_transition_requires_review`, `no_encounter`) are now catalogued (409) with UI messages, so detail is kept without passing raw text through. | `web/lib/api-contracts.mjs`, `use-patient-review-task.ts` | JS test | fixed |
| N-07 (R6) | `sourceScope` was validated then silently dropped, so a reference-scoped question would be answered from the patient corpus. `/api/ask` now returns `reference_scope_unavailable` (409) for `reference` before any model call; no reference search is built (out of SPEC scope for this route). | `web/app/api/ask/route.ts`, `api-contracts.mjs` | source + JS test | fixed (refuses; feature not built) |
| N-08 | PAT auth + session-scope verification (`CURRENT_ROLE()='SAARTHI_APP'`, secondary roles none, tolerating 003107 from restricted PAT sessions) in `web/lib/snowflake.ts` / `snowflake-config.mjs` were undocumented. Review note: this is consistent with AGENTS 3.1/3.2 (fail closed if the scope cannot be verified; PAT read from a file path, never embedded). Owner review still needed; no code change. | n/a | `snowflake-session.test.mjs` passes | documented |
| N-09 | Regenerated PDFs / cohort_events.json show as modified (timestamps). Not touched; do not commit as content changes without review. | n/a | n/a | not changed |

## SQL syntax-risk reductions (behaviour identical, `unverified-needs-deploy`)
1. `gate_spans`: the comma-LATERAL FLATTEN now sits alone in a new `gate_cites` CTE (`FROM READINESS_STATE rs, LATERAL FLATTEN(...) f WHERE ...`); `gate_spans` uses ordinary inner JOINs only. Span array is now deterministically ordered (`WITHIN GROUP (ORDER BY doc, page, char_start, assertion_id)`).
2. `evaluate_gates` SURV-LVEF-002: `QUALIFY ... OR ...` replaced by a subquery computing `rn_first`/`rn_last` with `event_id` tie-breaks, filtered by `WHERE rn_first = 1 OR rn_last = 1` (no extra ids on ties).
3. `web_reads` schemes: `LET` inside `ELSEIF` replaced by a DECLAREd `v_scheme_fin BOOLEAN DEFAULT FALSE` assigned with `:=`. Other `LET` uses inside branches (facts, coverage_comparison, evaluate_gates) are documented-valid Snowflake Scripting and were left unchanged to limit risk.
4. `04_scheme_eligibility`: explicit `REFRESH_MODE = FULL` (context function CURRENT_DATE() is not supported by incremental refresh) and the correlated `EXISTS` replaced by an aggregated LEFT JOIN.
Not changed: MERGE `ON a OR (b AND c)` in `08_create_review_task.sql` and the cross-practitioner replay returning another person's task id (low, QA item 5); deploy and test it, then decide.

## Not fixed and why
- Nothing in backend/sql was executed on Snowflake; every SQL fix is unverified until DEPLOY-ROUND-2 is run.
- Concurrency of CREATE_REVIEW_TASK, and the MERGE OR-join, remain unproven offline.
- The dev server on port 3000 still runs old code; restart it after step 13 (I did not touch it).
- `backend/scripts/bounded-session.mjs` (pre-existing, not changed) hardcodes a local key path and account identity; the new runner deliberately does not use its `session()`.
