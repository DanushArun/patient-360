# Deploy plan, round 3 (run by a human in Snowsight)

**This file supersedes `evidence/qa/DEPLOY-ROUND-2.md`** (and, before it, DEPLOY-ROUND-1). Round 2 miscounted the cohort
(D3-01) and did not say how the manifest is created. Do not follow it.

Nothing here has been executed on Snowflake: every SQL item is source-tested offline only (`unverified-needs-deploy`).
Synthetic data only. Engineering checks are not clinical validation. `setup.sql` is never run (it drops CORE tables).

## Fastest path: the generated bundle
`backend/sql/deploy/00_preflight.sql` ... `09_verify.sql`, built from the repo files by
`backend/scripts/build_deploy_bundle.py` (a test fails if it is stale). Paste each into one worksheet as ACCOUNTADMIN, "Run all",
read its VERIFY block, stop at the first failure. `08_pipeline_kickoff.sql` is run statement by statement.
`backend/sql/deploy/README.md` has the order and pass criteria. The per-step table below is the same plan by source file.

## True counts (D3-01)
* Manifest `data/generated/cohort_document_manifest.json`: **16 documents for 11 patients** (PAT-DC-01..11): 11 lab reports and 5
  pathology reports (PAT-DC-01, 02, 04, 06, 10). The load emits 36 statements: 4 header, 16 `DOCUMENT` MERGEs, 16 `DOC_PAGE` MERGEs.
* `data/generated/pdf/cohort/` holds 22 files: **6 stale** PDFs (`DOC-PATH-DC-03, 05, 07, 08, 09, 11`) that are not in the manifest and are
  never loaded. The generator now reports them and removes them only with `--prune`.
* PAT-DEEP-0001 is the twelfth patient: its documents come from `load_synthetic.sql` (`DOC-SURG-NOTE-01` with a synthetic one-page
  source text, `DOC-DUP-ORIG-01`, `DOC-DUP-COPY-01`, `DOC-INJECT-01`), plus the live Tata Memorial CBC. Its three seeded surgical
  assertions stay `unverified` until the two-pass run reads the page (R7); a document-cited gate span for PAT-DEEP-0001 exists only if
  both model families verify one.

## How the manifest is created (D3-01)
`./venv/bin/python -m data.generator.cohort_documents --manifest data/generated/cohort_document_manifest.json`
renders the PDFs from `data/generated/cohort_events.json` and writes the JSON array. Add `--prune` to delete stale PDFs.
Then `./venv/bin/python -m backend.scripts.prepare_synthetic_documents data/generated/cohort_document_manifest.json data/generated/pdf/cohort cohort_docs.sql`
(or just rebuild the bundle). Regenerate the manifest on the deploy day: `effective_at` is frozen at generation while
`load_daycare_cohort.sql` re-anchors event dates (QA N3 section 4), and the document to event `supports` links match by date.

## Order and verification query per step
Context for every worksheet: `USE ROLE ACCOUNTADMIN; USE SECONDARY ROLES NONE; USE DATABASE SAARTHI; USE WAREHOUSE SAARTHI_AI_WH;`

| # | Bundle file | Sources | Verification query (expected) |
|---|-------------|---------|-------------------------------|
| 0 | `00_preflight.sql` | read-only | `DESC STAGE SAARTHI.STAGES.PATIENT_DOCS` shows SNOWFLAKE_SSE; `SHOW TASKS IN SCHEMA SAARTHI.OPERATIONAL` recorded; baseline counts saved |
| 1 | `01_web_procedures.sql` | `web_reads`, `web_workflows`, `web_evidence` | `INFORMATION_SCHEMA.PROCEDURES` lists 6 names (GET_WEB_WORKSPACE, GET_WEB_PATIENT_DATA, UPDATE_WEB_REVIEW_TASK, REFRESH_BOUND_READINESS, RECORD_WEB_ANSWER, PREPARE_WEB_PACKET) |
| 2 | `02_gates_and_scheme_table.sql` | `evaluate_gates`, `bind_patient`, `04_scheme_eligibility` | 2 procedures; `SHOW DYNAMIC TABLES LIKE 'DT_SCHEME_ELIGIBILITY'` refresh_mode = FULL |
| 3 | `03_tool_procedures.sql` | tools 01,02,03,06,07,08, `extract_one_document`, `validate_answer` | 10 procedures listed (includes `bind_patient`, `evaluate_gates` from step 2) |
| 4 | `04_governance_row_access.sql` | RAP section of `governance/01_policies.sql`, re-attach from `02_attach_policies.sql` | `POLICY_REFERENCES('SAARTHI.GOVERNANCE.PATIENT_SCOPE')` returns exactly DOC_PAGE |
| 5 | `05_tasks_and_grants.sql` | `reconcile_evidence`, `orchestrator`, `03_grants` | 2 procedures; both tasks `suspended` in `SHOW TASKS` |
| 6 | `06_seed_data.sql` | `load_synthetic` | `DOC_PAGE` rows for DOC-SURG-NOTE-01 = 1; PAT-DEEP-0001 exists |
| 7 | `07_cohort_and_documents.sql` | `load_daycare_cohort` (skip if preflight showed 12 patients), generated MERGEs | 16 documents over 11 patients |
| 8 | `08_pipeline_kickoff.sql` | chunk, extract (repeat), reconcile, refresh_readiness | each CALL returns without error |
| 9 | `09_verify.sql` | read-only | documents per patient lists all 12; zero rows from the "verified without agreeing passes or span" query; every patient has `with_evidence >= 1` |

Pass criteria that depend on live model output (assertion counts by `verification_status`) are invariants, not numbers; see the
bundle README. Then restart the web server and open `/patient/PAT-DC-01`: the timeline shows the diagnosis as "Present" with its
ICD label, never "Not received"; reference search is greyed out with an explanation.

## Credentials and role (N3-07)
* Prefer Snowsight. If you use `backend/scripts/run-sql-from-env.mjs`: export `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_ROLE`
  (required, no default), set the secret at a hidden prompt (`read -rs` then `export`) or point `SNOWFLAKE_PAT_FILE` at a token file.
  Never put a secret on a command line. Password auth was removed. ACCOUNTADMIN is refused unless `--allow-accountadmin` is passed.
* Dry run is the default; `--apply` executes.

## Rollback
Every object is `CREATE OR REPLACE`; re-run the previous file version from `git show`. Data MERGEs are insert-only except the
`load_synthetic.sql` repair UPDATE (`unverified` is the safe direction). The RAP step detaches and re-attaches in one file; if it fails
midway re-run `04_governance_row_access.sql` whole (DOC_PAGE is briefly unprotected only between the detach and the attach inside it).
