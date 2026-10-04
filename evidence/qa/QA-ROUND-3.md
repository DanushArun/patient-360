# QA Round 3 (independent) - 2026-10-04

Scope: re-run every gate, verify Round-2 findings (QA-ROUND-2.md N-01..N-08, D-02..D-04) from code, hunt regressions, static review of changed SQL, review of the document-prep and run-sql scripts, walk DEPLOY-ROUND-2.md, read-only live GET sweep.
FIX-ROUND-2.md was not used as evidence. No fixes made. No git writes. No credential files read. No POST/PATCH to live routes. No SQL executed against Snowflake (`run-sql-from-env.mjs` was run in its default dry-run mode only, with an empty environment).
Engineering checks on synthetic data; not clinical validation. Everything in backend/sql is `unverified-needs-deploy`.

## 1. Test run table (all re-run by me)

| # | Run | Round 2 | Round 3 |
|---|-----|---------|---------|
| 1 | `cd web && npm test` | 273 pass / 0 fail | **276 pass / 0 fail / 0 skipped / 0 cancelled** |
| 2 | `npm run typecheck` | 0 errors | **0 errors** |
| 3 | `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | 15 routes | **OK, 15 routes + `/_not-found`** (page/API list unchanged, no test fixture routes) |
| 4 | `npm run test:e2e` | 40/40 | **40 pass / 0 fail / 40 total** (21.0 s) |
| 5 | `./venv/bin/python -m pytest -q` | 335 pass / 14 skip | **351 pass / 0 fail / 14 skipped / 36 subtests pass** |
| 6 | `prepare_synthetic_documents` (scratchpad output) | 19.5 KB | **16.9 KB, 16 documents, 36 statements** (see D3-01: plan says 22) |
| 7 | Live GET sweep (127.0.0.1:3000) | 38/38 as expected | **34 requests: 30 x 200, 4 x 403 (malformed id `BAD!x` on the 4 API routes), 0 x 5xx, no crash** |

Side effect: my `npm run build` rewrote `web/.next` again. The live server is stale (see section 6).

## 2. Round-2 findings, each verified from code

| ID | Round-2 finding | Verdict | Evidence |
|----|-----------------|---------|----------|
| N-01 | missing `value_state` rendered "not_received" beside a value | **VERIFIED fixed in the mapper**; but see NEW N3-01 (SQL side) | `web/lib/workspace-patient-facts.mjs:25-30` `deriveValueState`: valid state wins, else value or non-blank text gives `present`, else `state_unavailable`; `factStateLabel` returns "State unavailable" for unknown. Used by `lib/patient.ts:168`. Unit tests `workspace-patient-facts.test.mjs:41-49` pass. All 7 R3 states have labels (lines 1-9). |
| N-02 | census header said "No readiness computed yet" when rows lack a clock | **VERIFIED** | `web/lib/census.ts:121-127` `censusClockLabel(error, asOf, loadedAt, rowCount)`: rows without clock gives "Readiness clock not reported by the server", only zero rows gives "No readiness computed yet". Wired at `app/page.tsx:59`. |
| N-03 | deploy order: new web needs new `tasks` view | **VERIFIED in plan** (DEPLOY-ROUND-2 step 1 is web_reads, step 14 restarts web last). Caveat: the read-back confirms the *original* task row by id plus `ISSUE_VERSION`, not the new state/owner (`patient.ts:~139`, `web_workflows.sql:129-135` returns `TASK_REF`). Info only. |
| N-04 | documents sub-page not 404 on bad id | **VERIFIED** | `app/patient/[id]/documents/[doc]/page.tsx:21` `notFound()` outside the try; also patient/history/navigator pages. Live server still shows old behaviour (200). |
| N-05 | packets `LIMIT 50` without ORDER BY | **VERIFIED** | `web_reads.sql` packets view: `AND (:ARGUMENT IS NULL OR ep.packet_id=:ARGUMENT)` and `ORDER BY ep.delivered_at DESC, ep.packet_id LIMIT 50`. Columns exist in `40_evidence.sql`. |
| N-06 | `/api/review-task` collapses uncatalogued errors to `action_unavailable` | **Unchanged by design** (catalogued codes pass through, others become `action_unavailable`/409). Low, accepted. |
| N-07 | `/api/ask` dropped `sourceScope` | **Server side VERIFIED** (`app/api/ask/route.ts:23-27` returns 409 `reference_scope_unavailable`; catalogue test exists). **UI side regressed**, see N3-02. |
| N-08 | PAT auth / session verification undocumented | Not re-reviewed; tests in `snowflake-session.test.mjs` pass inside the 276. Info. |
| D-02 | plan used `PUT` | **VERIFIED**: default generator output has 0 `PUT` lines; `--with-put` is opt-in. Pure SQL MERGEs only. Counts in the plan are wrong, see D3-01. |
| D-03 | `load_synthetic.sql` missing from deploy list | **VERIFIED**: DEPLOY-ROUND-2 step 12. Repair UPDATE values (`unverified`, `pending`) satisfy the CHECK constraints in `40_evidence.sql`. |
| D-04 | partial-file runs for reconcile/orchestrator | **VERIFIED**: steps 9 and 10 are now whole-file; both files contain `CREATE OR REPLACE TASK` and the plan states they are re-created suspended and covers root-task suspension. |
| CR1-ish (SQL) | gate_cites/gate_spans, LVEF subquery, schemes variable, DT FULL | Static review below: no syntax or column error found. |

## 3. NEW failures

| ID | Sev | Finding | Repro | Expected vs actual | Location |
|----|-----|---------|-------|--------------------|----------|
| **N3-01** | **Medium (R3 truthfulness)** | The rewritten timeline SQL labels every event that has no value and no value_text as `not_received`, including recorded diagnosis events (status `final`). | Static: `load_daycare_cohort.sql` inserts `EVT-DC-NN-DX` (event_type `diagnosis`, status `final`, no value, no concept). In `06_get_timeline.sql` the `value_state` CASE falls to `ELSE 'not_received'`. Live evidence of the affected rows (old procedure, same data): `EVT-DC-01-DX`, `EVT-DC-10-DX`, `EVT-DX-01` (DEEP-0001) all `value: null`, concept "Unlabelled event". After deploy the UI renders "Unlabelled event · Not received" for a diagnosis that is on file. | Expected: a received final event with no scalar value is not "not received" (state `present` or an explicit "recorded, no value" label); only `status='ordered'` is `pending`; "not_received" only when the event is genuinely absent. Actual: "Not received" next to a recorded final event, the exact R3 inversion AGENTS.md forbids ("Not received is never negative"/never mislabel presence). Secondary: concept label "Unlabelled event" because `DT_HARMONIZED_EVENTS` carries no `display`/code. | `backend/sql/procedures/tools/06_get_timeline.sql` value_state CASE (the `ELSE 'not_received'` branch, ~line 118-121) |
| **N3-02** | Low-Medium (UI/contract drift) | "Search in: reference" is still selectable. Real `/api/ask` now returns 409 `reference_scope_unavailable`, but the UI has no copy for it (`TURN_ERRORS`) and shows "No answer is available for this request. Retry or rephrase." with a Retry button that can never succeed. The e2e test `test_answers_when_scope_changes...` intercepts `**/api/**` and expects a "Reference passage" answer, so no test exercises the real contract. | Select Search in = reference, ask anything, against the real route. | Expected: scope option disabled or a specific message ("Reference corpus search is not available"); e2e asserts the real 409 path. Actual: generic retryable error. Fails closed, so R6 is safe; usability and test honesty are not. | `web/components/workspace-patient-copilot.tsx:30-47,265,355-358`; `web/tests/e2e/workspace-flow.spec.ts:110-114` |
| **D3-01** | Medium (plan accuracy, deploy) | DEPLOY-ROUND-2 miscounts the cohort and omits how the manifest is made. It says "36 statements for the 22-file cohort" and "expect 22 rows across the 12 cohort patients". Actual: manifest has **16 documents for 11 patients** (36 statements = 4 header + 16 DOCUMENT + 16 DOC_PAGE). 22 PDFs sit in `data/generated/pdf/cohort/` but 6 (`DOC-PATH-DC-03,05,07,08,09,11`) are stale and not in the manifest. `data/generated/cohort_document_manifest.json` is untracked and no documented step creates it (`data/generator/cohort_documents.py` only prints manifest lines). | `ls data/generated/pdf/cohort \| wc -l` = 22; `len(manifest)` = 16; run generator, count MERGEs. | A human running verification query 2 sees 16 (plus DEEP seed docs), not 22, and will think the load failed. | `evidence/qa/DEPLOY-ROUND-2.md` step 11, post-deploy query 2; `data/generator/cohort_documents.py` |
| **D3-02** | Low-Medium | PAT-DEEP-0001 has no loadable source text for citations: the generator/manifest covers only PAT-DC-01..11; DEEP-0001 documents come only from `load_synthetic.sql` (`DOC-SURG-NOTE-01` has no DOC_PAGE row; `DOC-DUP-*` none; `DOC-INJECT-01` page 1 is the injection test). After the D-03 repair its three SURG assertions are `unverified` with NULL spans, so DEEP-0001 can never show a document-cited gate span. Reachability of "document, citation" fields for 11 of 12 patients only. | Read `load_synthetic.sql:206-228,498-520`. | Honest per AGENTS.md section 4 but must be stated in README/IMPLEMENTATION-STATUS; the plan implies all 12 are covered. | `backend/sql/data/load_synthetic.sql`, DEPLOY-ROUND-2 post-deploy 2 |
| N3-03 | Low | Error catalogue incomplete: codes used as fallbacks or produced by pages are not in `ERROR_CATEGORIES`: `readiness_refresh_unavailable` (POST `/api/patient/[id]`), `workspace_data_unavailable`, `record_service_unavailable` (`app/page.tsx:35`), default `service_unavailable`. They resolve to category `unavailable`/502 by default, so no crash, but they bypass the typed catalogue and have no UI copy. | grep of `apiError(... "code")` vs `lib/api-contracts.mjs:15-45`. | Add to catalogue. | `web/lib/api-contracts.mjs`, `app/api/patient/[id]/route.ts:30` |
| N3-04 | Low | Labs facts view reports `value_state = h.plausibility_state` (always `present` or `unreadable`), while the timeline now derives a richer state. A lab row with neither value nor text shows "Present" with "-" in the facts table but "Not received" in the timeline: two views disagree on one record. | `web_reads.sql` labs branch `'value_state', h.plausibility_state` vs `06_get_timeline.sql` CASE. | Use one derivation (shared CASE). | `web_reads.sql` facts/labs |
| N3-05 | Low (security hygiene) | Governance RAP `patient_scope` (`governance/01_policies.sql:46-60`) uses `CURRENT_USER()` correctly but, unlike every procedure, ignores `role_type`, `p.active` and consent. A deactivated or navigator/consulting care-team row still passes layer 3. Pre-existing, not touched in Round 2; procedures are the stricter gate. Also masking policies key on `CURRENT_ROLE()='ACCOUNTADMIN'` (documented intent, not a RAP). | Read policy. | Align RAP with the procedure predicate or document why it is intentionally broader. | `backend/sql/governance/01_policies.sql` |
| N3-06 | Info | `reconcile_evidence_proc` now writes `discordant_across_specimens` EVIDENCE_LINK rows (both directions per pair) but `DOC-DISC-001` in `evaluate_gates.sql` still counts distinct `specimen_id` on CLINICAL_EVENT and never reads those links; the generated documents set no `accession_id`, so the join cannot fire. No wrong outcome, but the discordance link work is currently unreachable from any gate. | `evaluate_gates.sql:302-317` vs `reconcile_evidence.sql:43-77`. | Status doc should mark as `designed-only` for document-derived discordance. | |
| N3-07 | Info | `run-sql-from-env.mjs`: safe on credentials (see section 5) but defaults role to `ACCOUNTADMIN` and its documented usage puts `SNOWFLAKE_PASSWORD=<...>` inline on the command line (shell history). | file header | Prefer `SNOWFLAKE_PAT`/key path or prompt. | `backend/scripts/run-sql-from-env.mjs` |

No High-severity defect found.

## 4. Static SQL review (backend/sql changed files)

Method: read each diff against `backend/sql/tables/*.sql`. Snowflake could not be run; scripting-block column errors surface only at CALL time, not at CREATE time, so these remain `unverified-needs-deploy`.

| File | Result |
|------|--------|
| `web_reads.sql` `gate_cites` / `gate_spans` | Syntactically valid. `gate_cites` is a single comma-LATERAL FLATTEN (documented form); joins moved to `gate_spans`. Columns exist (`READINESS_STATE.evidence_ids/known_as_of/rule_version`, `ASSERTION.char_start/char_end/page_index/verification_status`, `DOCUMENT.version/scope/status`, `DOC_PAGE.text`). Span guard `char_end <= LENGTH(text)` present. Spans restricted to `verified` assertions, bound patient, `scope='patient'`. `WITHIN GROUP (ORDER BY ...)` placement valid. Outer LEFT JOIN on (rule_id, rule_version) is safe: gate_cites is already limited to the chosen encounter. |
| `web_reads.sql` schemes branch | `v_scheme_fin BOOLEAN DEFAULT FALSE` is declared in DECLARE (not a LET inside ELSEIF), assignment `COALESCE(ARRAY_CONTAINS(...), FALSE)` is NULL-safe, `IFF(:v_scheme_fin, ...)` valid. Fail-closed: missing consent row yields `financial_consent_required`. |
| `web_reads.sql` other | `tasks` by-id branch still scoped to bound patient; `packets` by id plus ORDER BY; `document` view validates `doc_id|cutoff` with regex and `ARRAY_SIZE(SPLIT())>2`; `documents` view missingness CASE is R7-aligned (only verified present => `present`), all 7 R3 states reachable, default `pending`. Census adds `known_as_of`/`computed_at`. All CARE_TEAM sites have `role_type IN ('treating','coordinator')`; all identity matches are exact `CURRENT_USER()`. |
| `evaluate_gates.sql` | `v_ev`/`v_support` declared; every `v_ev := (SELECT COALESCE(ARRAY_AGG(..), ARRAY_CONSTRUCT()) ...)` is valid; `ID_MAP.map_id`, `COVERAGE.coverage_id`, `AUTHORIZATION.auth_id`, `CLINICAL_EVENT.event_id`, `ASSERTION.assertion_id/subject/predicate` exist. LVEF rewrite is two row_number windows in a derived table filtered by `rn_first=1 OR rn_last=1` (no QUALIFY-OR); valid, deterministic tie-break. Fail-open scan: none; SURG evidence only includes `verified` assertions. |
| `04_scheme_eligibility.sql` | `REFRESH_MODE = FULL` with `TARGET_LAG`, `INITIALIZE`, `WAREHOUSE` is valid; no AI function (AGENTS 3.9 respected); correlated EXISTS replaced by aggregated LEFT JOIN with `COUNT_IF(...)>0`; `COVERAGE.effective_from/effective_to/payer_type`, `PATIENT.state`, `SCHEME_REGISTRY` columns all exist. Domicile alone gives `eligibility_unverified` (R1/R3 correct). `CREATE OR REPLACE` drops the table's grants (reads go through owner's-rights procedure, so acceptable). |
| `06_get_timeline.sql` | Valid and column-correct (`DT_HARMONIZED_EVENTS` has no `unit`/`status`, so `ce.unit`/`ce.status` joins do not collide; derived ANC rows have no CE row, so state is `present` by value). Logic defect N3-01. |
| `08_create_review_task.sql` | `BEGIN TRANSACTION`, single INSERT-only MERGE with OR-join (valid, no multi-match error as no WHEN MATCHED), `SQLROWCOUNT`, EXCEPTION ROLLBACK/RAISE: valid. MERGE takes the table lock so concurrent duplicate waits: reasoning sound, runtime unproven. Residual: replay by the open-task branch returns another practitioner's task id (low); the `v_role_type` lookup (line ~100) has no `role_type` filter and takes the latest row, so a practitioner whose newest care-team row is `consulting` is denied although the preamble allowed them (fails closed). |
| `web_workflows.sql` | Issue-close UPDATE runs after the task state UPDATE inside the same transaction, so NOT EXISTS sees the new state; `closed` satisfies the REVIEW_ISSUE CHECK. |
| `reconcile_evidence.sql` | Valid MERGEs; fixes a latent CHECK violation (old code set `missingness_state='discordant_across_specimens'`, not in the CHECK list); biomarker/accession gating sound; `a.unit = ce.unit` NULL-unit pairs never link (intended). |
| `orchestrator.sql` | `v_reconciled := (CALL ...)` follows the existing pattern; reconcile runs before readiness. |
| `load_daycare_cohort.sql` | `LEAST(anchor-offset, now-3h)` valid; `IFF(t.event_time = s.event_time, t.ingested_at, CURRENT_TIMESTAMP())` reads the pre-update value in Snowflake. Note the cap uses deploy-time `CURRENT_TIMESTAMP()` while `DOCUMENT.effective_at` in the manifest is frozen at generation, and reconcile links on `event_time::DATE = effective_at::DATE`; a reload on a later day silently drops the document-to-event 'supports' links. Live data currently agree (live DC-01 lab event_time `2026-10-03 23:03:11` = manifest). The file is not in the deploy plan (live already has the capped version). |
| `load_synthetic.sql` | Repair UPDATE idempotent; values satisfy CHECKs. |
| Preamble role/user changes (tools 01,02,03,06,07,08, bind, extract_one_document, validate_answer, web_evidence, web_workflows) | Every file that selects from CARE_TEAM carries `role_type IN ('treating','coordinator')` except the 5 untracked NOT-DEPLOYED web_*.sql files and `governance/01_policies.sql` (N3-05). No `CURRENT_ROLE()` is used for scoping anywhere in procedures. |
| Idempotence | All changed objects are `CREATE OR REPLACE`, INSERT-only MERGE, or a re-runnable UPDATE. |

## 5. Scripts

**`backend/scripts/prepare_synthetic_documents.py`** (run offline to the scratchpad, never against Snowflake)
- Output: 16 DOCUMENT MERGEs + 16 DOC_PAGE MERGEs + 4 header statements; 0 `PUT`; only control character is `\n`.
- Columns match `30_documents.sql`: DOCUMENT (`doc_id, patient_id, scope, doc_type, version, file_hash, source_path, source_quality, signed_at, effective_at, ingested_at, source_facility_id, ingestion_method, status`), DOC_PAGE (`doc_id, page_index, text, char_count`). CHECK values (`clean_pdf`, `digital_emr`, `active`, `patient`) are valid. `FAC-02` exists in `load_synthetic.sql`.
- Escaping: `literal()` doubles `'` and `\` (correct for Snowflake single-quoted strings). Tested with a string containing `'`, `\`, `\'`, `;`, `--`, `/* */`, `$$`, newline and `"`: the repo's own `statements()` splitter keeps it as one statement.
- Safety: patient allow-list, doc-id regex, path confined to the PDF dir, size/page limits, synthetic-label check, idempotent (`WHEN NOT MATCHED`). Does not set `accession_id`/`revision_type` (N3-06).
- `ingested_at = CURRENT_TIMESTAMP()` is account-time; signed_at/effective_at come from the manifest (consistent with the live account time zone, observed live).

**`backend/scripts/run-sql-from-env.mjs`**
- Credential handling safe: dry run is the default (no connection made; verified with `env -i`, 36/54/12 statements counted for the three files tried); `--apply` required to execute; secrets read only from env vars or a key file path you name; nothing printed or embedded except SQL text previews in dry-run (first 110 chars) and driver `error.code/message` on failure; the connection and bounded-session constants (`bounded-session.mjs` has a hard-coded account and key path, in a function this script never calls). `USE SECONDARY ROLES NONE` is run first (AGENTS 3.2).
- Notes only: N3-07 (ACCOUNTADMIN default, password on command line in docs); requires `snowflake-sdk` even for a dry run.

## 6. DEPLOY-ROUND-2.md walkthrough

| Check | Result |
|-------|--------|
| Every object a web route calls is installed | Yes: web_reads (GET_WEB_WORKSPACE, GET_WEB_PATIENT_DATA), web_workflows (UPDATE_WEB_REVIEW_TASK, REFRESH_BOUND_READINESS), web_evidence, tools 01/02/03/06/07/08, bind/release, DT_SCHEME_ELIGIBILITY. |
| Dependency order | Consistent: web_reads first, DT before data, gates before readiness refresh, reconcile proc before orchestrator proc, tasks re-created suspended, root-task suspension pre-checked. |
| Verification query per step | **Not per step.** One shared post-deploy block (SHOW PROCEDURES, DT refresh mode, document counts, assertion/evidence counts, readiness evidence, DEEP assertions). No query for: bind_patient/preamble role_type change, create_review_task MERGE, orchestrator/reconcile task state (`SHOW TASKS` is only in the pre-checklist), grants. The `SHOW PROCEDURES` expectation omits chunk/extract/reconcile/refresh procedures that step 14 `CALL`s. Because scripting column errors surface only at CALL time, "compiled" is not evidence; the app smoke test (step 14) is the real check. |
| Counts and doc inputs | Wrong, see D3-01. |
| 12 patients reachable | PAT-DC-01..11 from `load_daycare_cohort.sql` (not in the plan; already live and already carrying the LEAST-capped times) with 16 documents; PAT-DEEP-0001 from `load_synthetic.sql` only, no usable document page for citations (D3-02). |
| `setup.sql` | Still forbidden (drops CORE tables); plan says so. |

## 7. Live read-only GET sweep (127.0.0.1:3000)

34 GETs: `/`, `/review-queue`, and for PAT-DC-01, PAT-DC-10, PAT-DEEP-0001, `BAD!x`: `/api/patient/{id}`, `/timeline`, `/schemes`, `/evidence`, `/patient/{id}`, `/history/{id}`, `/navigator/{id}`, `/patient/{id}/documents/DOC-LAB-DC-01`.
Result: 30 x 200, 4 x 403 (the four malformed-id API calls), no 5xx, no crash.
The server is stale and mixed (compiled before the Round-2 fixes, partly refreshed by my build): `/api/patient/BAD!x` returned the new typed body `{"error":"no_patient_access","category":"access","purge_patient_state":true}`, the sibling timeline/schemes routes still return the old `{"error":"bind failed: no_patient_access"}`, and `/patient/BAD!x`, `/history/BAD!x`, `/navigator/BAD!x` and the documents page return 200 instead of 404. Live `/api/patient/PAT-DC-01/timeline` still has 7 fields and no `value_state` (old mapper, old procedure). So no Round-2 fix is confirmable live; confirmation rests on unit tests, build, e2e and code reading. Restart required.

## 8. Unverified, needs deploy (cannot be proved without Snowflake)

1. Compilation and runtime of every changed procedure (web_reads gate_cites/gate_spans, schemes, tasks-by-id, packets, census clock; evaluate_gates evidence ids; 06 timeline; 08 MERGE concurrency; web_workflows issue close; reconcile; orchestrator).
2. `DT_SCHEME_ELIGIBILITY` re-create with `REFRESH_MODE = FULL` (refresh mode column after SHOW).
3. `read_back_confirmed` end to end, and the "one REVIEW_TASK row, one replay" concurrency claim.
4. Pipeline numbers: verified assertions, EVIDENCE_LINK counts, gates with non-empty `evidence_ids`, source spans appearing in the app.
5. Date alignment between the frozen document manifest and deploy-time-anchored events (affects 'supports' links).
6. Role/practitioner picker behaviour with exact-case `CURRENT_USER()`.
7. The Round-2 fixes in the live UI after a server restart.

## 9. Verdict

Offline gates are green (276 / 0 typecheck errors / build ok / 40 e2e / 351 pytest). All Round-2 items verified in code except that one SQL-side R3 inversion was introduced by the fix (N3-01) and one UI/contract gap by the `reference_scope_unavailable` change (N3-02). Plan accuracy defects (D3-01, D3-02) must be corrected before a human follows DEPLOY-ROUND-2. Open failures resolvable with no Snowflake access: N3-01, N3-02, D3-01, D3-02, N3-03, N3-04, N3-06, N3-07 (and N3-05 as a code/doc decision). None needs the account to fix; only their runtime proof does.
