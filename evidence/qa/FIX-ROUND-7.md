# FIX-ROUND-7: judge-facing packaging

Date: 2026-10-04. Working tree only: no git writes, no SQL run against Snowflake, no web access, no credential files
read. Documentation only; no feature code and no `backend/sql`, `IMPLEMENTATION-STATUS.md` or `evidence/coco/README.md`
edits (owned by another agent).

## Files

| File | Change |
|---|---|
| `README.md` | One-line principle, "Evaluate in 15 minutes" box (offline steps, live path with the not-run-on-clean-account statement), measured-results table, links to the new docs; existing content kept; test-count line updated |
| `docs/PLATFORM-FINDINGS.md` | New. 8 findings with query IDs, account FV11738, date 17 Sep; N4-03 listed as open |
| `docs/FAILURE-AND-FIX-INDEX.md` | New. 34 rows from QA-ROUND-1..4, FIX-ROUND-1..5, DEPLOY-ROUND-4, `evidence/coco/*` |
| `docs/JUDGE-WALKTHROUGH.md` | New. Timed reading path mapped to the three criteria, plus the not-yet-live list |
| `evidence/qa/FIX-ROUND-7.md` | This file |

`evidence/qa/FIX-ROUND-6.md` does not exist, so no deterministic-baseline eval number is quoted. A file
`backend/eval/results/dev_deterministic_routing_report.json` is present in the tree but was not read or covered by a QA
round; the README says 0 scored.

## Counts re-run today (offline)

| Check | Result |
|---|---|
| `cd web && npm test` | 257 passed, 0 failed |
| `./venv/bin/python -m pytest -q` | 375 passed, 14 skipped, 0 failed (36 subtests passed) |
| `npm run typecheck` | clean |
| `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | succeeded |
| `npm run test:e2e` | Run 1: **39 passed, 1 failed** (`storyboard-visual.spec.ts:20`, cause not diagnosed). Runs 2 and 3: 40 of 40 passed. A fourth run's result line was not captured. One direct `npx playwright test` of that spec against the repo failed because the fixture routes only exist in the temp copy `run-e2e.mjs` builds (invalid invocation, not a finding). Treated as a possibly flaky test, unresolved |
| `python3 backend/scripts/check_gate.py --manifest` | PASS |
| `build_deploy_bundle --check` | "deploy bundle is current (11 files)" |

## Verified

- Every query ID in `PLATFORM-FINDINGS.md` was copied from `evidence/coco/verification-query-ids.md`; none invented.
  Finding 8 (AI functions in Dynamic Tables) has no recorded query ID and says so.
- Account, date and N4-03 status taken from that file, QA-ROUND-4, FIX-ROUND-4 and DEPLOY-ROUND-4. The deploy bundle
  step 07 contains `p_doc_id` and the `DOC-RAP-CANARY-01` canary (grep).
- Relative links in `README.md` and the three new docs checked by script (below).
- Not verified: any live claim (reported only); competitor statements (none made beyond "we did not find").

Link check result: see the last section, filled after the run.

## Link check (run after the last edit)

Script checked every relative Markdown link and every backticked repo path in `README.md`, `docs/PLATFORM-FINDINGS.md`,
`docs/FAILURE-AND-FIX-INDEX.md`, `docs/JUDGE-WALKTHROUGH.md` and this file: 0 broken links. One non-path match
(`backend/sql/deploy/00`, prose for "steps 00 to 09") is expected. Mentioned paths also checked with `ls`.
