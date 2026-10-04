# FIX ROUND 4 (input: QA-ROUND-4.md). Working tree only, no git writes, no SQL run.

All SQL is `unverified-needs-deploy`. Synthetic data; engineering checks, not clinical validation.

| ID | RCA | Files | Verification | Status |
|---|---|---|---|---|
| N4-01 | Grants came after two `CREATE OR REPLACE TASK` statements; a started root made the child CREATE fail and Run all skipped the grants; suspend was a comment; AGENT/MCP grants failed when the objects were absent. | `backend/scripts/build_deploy_bundle.py` (step 04 composition; repo `tasks/*.sql`, `03_grants.sql` split, not changed) -> `deploy/04_tasks_and_grants.sql`, `00_preflight.sql` | `test_n4_01_*` (grants before first CREATE TASK; executed `ALTER TASK IF EXISTS ... SUSPEND` in 00 and 04; AGENT/MCP grants each in EXECUTE IMMEDIATE with EXCEPTION). Runtime unproven. | fixed in source, needs deploy |
| N4-02 | A MERGE target scan is filtered by the RAP; for a non-PRAC-01 user existing pages are invisible, so MERGE inserts duplicates. Step 08 saw nothing silently. | bundle reordered: RAP is now step 07 (after seed 05 and cohort 06, which start with a guarded detach); 08 starts with a raising guard (user = PRAC-01, policy attached, 5 procedures, cohort pages visible); 09 has RAP guard and a duplicate-page query | `test_n4_02_*`; bundle `--check` | fixed in source, needs deploy |
| N4-03 | Real hazard: unqualified `doc_id` inside a subquery over DOCUMENT d binds to the innermost column (`d.doc_id = d.doc_id`, always true). | `backend/sql/governance/01_policies.sql`: argument renamed `p_doc_id`, both comparisons qualified. Step 07: synthetic canary (`DOC-RAP-CANARY-01`, patient with no care team), attach, negative test that RAISES if the canary page is visible (0-row SELECT plus block); also in 09 | `test_n4_03_*`, `test_policy_body_has_no_unqualified_argument_name_collision`. Runtime proof only on deploy. Note: the pre-existing deployed policy may have been exposed; step 07 replaces it. | fixed in source, needs deploy |
| N4-04 | A final event with a concept and no value showed a bare "Present". | `web/lib/workspace-patient-facts.mjs` (`factStateDisplay` -> "Present · no value recorded"), used in `patient-timeline.tsx`, `workspace-patient-facts.tsx`, `evidence-packet-preview.tsx`; test updated in `backend/tests/test_round2_fix_contracts.py` | node test + pytest | fixed |
| N4-05 | RAP detach/recreate failure leaves DOC_PAGE unprotected until re-run. | README + DEPLOY-ROUND-4 "run step 07 again before anything else"; automatic guards in 08 and 09 | `test_n4_02_*` | mitigated (window remains during 05-07, inherent) |
| N4-06 | Procedures outside the bundle unverified. | preflight missing-procedure query (6 names); 08 guard checks the 5 it calls | `test_n4_06_*` | fixed (check, not creation) |
| N4-07 | Info only. | none | | n/a |

New/changed tests: `backend/tests/test_deploy_bundle.py` (+4, paths renumbered), `backend/tests/test_round4_fix_contracts.py` (3), `web/lib/workspace-patient-facts.test.mjs` (+1).

## Local AI removal
Deleted from disk (tracked, recoverable; no git rm): `local-ai/` (Modelfile, README.md, setup.sh, .env.example), `web/LOCAL-AI-PARITY.md`, `web/lib/local-ai.mjs`, `local-ai.d.mts`, `local-ai-artifact.mjs`, `local-ai-tools.mjs`, `local-ai.test.mjs`, `local-ai-artifact.test.mjs`, `local-ai-parity.test.mjs`.
Kept by moving: `sourceIds` (used by the Snowflake answer-history path) -> new `web/lib/source-ids.mjs`; `local-ai-routing.test.mjs` tests Snowflake question routing, renamed `web/lib/question-routing.test.mjs`.
Edited: `web/lib/patient.ts` (one provider, Snowflake `ASK_SAARTHI`; no behaviour change to that path), `web/package.json` (`test:local-ai` removed), `web/README.md`, `README.md`, `docs/PROTOTYPE-COST-CONTROLS.md`. `evidence/` and `planning/` untouched (history). `docs/WORKSPACE-*`, `docs/superpowers/plans/*` still mention it as history.
**User action:** `web/.env.example` is deny-listed and still matches a case-insensitive Ollama/provider grep; please remove any `SAARTHI_LLM_PROVIDER`/Ollama lines yourself.

## Gates (re-run after all changes)
`npm test` 257 pass / 0 fail (279 before: 22 local-ai tests removed, 1 added); `npm run typecheck` 0 errors; `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` OK; `npm run test:e2e` 40/40; `./venv/bin/python -m pytest -q` 373 pass / 14 skipped / 0 fail; `build_deploy_bundle --check` current (11 files).
