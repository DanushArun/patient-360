# FIX-ROUND-5 — submission documentation and honesty pass

Date: 2026-10-04 (entry freeze 11:59 PM IST). Input: `evidence/qa/JUDGE-EVALUATION.md`. Working tree only: no git
writes, no credential files read, no SQL run against Snowflake, no web access. Only documentation, one tiny offline
scorer and its test were changed; **no Snowflake SQL was touched**, so every SQL item stays `unverified-needs-deploy`.

## Offline re-verification (run 4 Oct 2026, after the edits)

| Check | Result |
|---|---|
| `./venv/bin/python -m pytest -q` | **375 passed, 14 skipped, 0 failed** (373 before; +2 new scorer tests) |
| `cd web && npm test` | **257 passed, 0 failed** (QA-ROUND-4 / JUDGE-EVALUATION quoted 279; the current run is 257, so the earlier figure is not reproduced) |
| `npm run typecheck` | clean |
| `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | succeeded; 7 page routes and 8 API routes listed |
| `npm run test:e2e` | **40 passed** (stubbed API, not live data) |
| `python3 backend/scripts/check_gate.py --manifest` | PASS |
| `./venv/bin/python -m backend.scripts.build_deploy_bundle --check` | "deploy bundle is current (11 files)" |

## Gap list -> action

| Gap | Action | Files | Status |
|---|---|---|---|
| 1 licence inventory | Created dataset/licence inventory: synthetic provenance, reference PDF table (692 pages), npm and Python licences read from `node_modules` and package metadata. Deck: outline only | `docs/DATASET-LICENCES.md`, `docs/DECK-OUTLINE.md` | Inventory done; per-file reference URLs/licences **not verified in repo** (team). **Deck itself: TEAM** |
| 2 README | Rewritten: what it is, R1-R7 table, offline and live quickstart (env var names only), real routes, repo map, built/partial/designed-only with counts, evidence map, limitations. Removed Judge Console, Streamlit, "6 screens", skills-orchestrated and eval claims; reworded goal (C-9); stale 30 Sept baseline replaced (C-18) | `README.md` | Done |
| 3 recording / URL | Demo script written (PAT-DC-04, PAT-DC-07, PAT-DC-01) | `docs/DECK-OUTLINE.md` | **TEAM** (record the video; nothing hosted) |
| 4 deploy bundle ordering | Already addressed in Round 4 (grants before tasks, preflight procedure check, re-run-07 note in `backend/sql/deploy/README.md`); drift check passes | - | Offline done; **DEPLOY**: never run on a clean account |
| 5 RAP `doc_id` binding N4-03 | Not changed (needs SQL edit plus live two-user negative test); stated as unresolved in README, STATUS | `IMPLEMENTATION-STATUS.md` | **DEPLOY** |
| 6 validator not in path | Relabelled partial everywhere (C-6) | `IMPLEMENTATION-STATUS.md`, `README.md` | Labelled; wiring is **DEPLOY** |
| 7 empty `backend/eval/` | SPEC s14 specifies the harness, so a minimal offline scorer was added (absolute counts, missing answers counted as not scored) with 2 tests. No results exist | `backend/eval/harness/score_results.py`, `backend/tests/test_eval_scorer.py` | Partial: scorer built; **running the 80 questions needs Snowflake (paid)** |
| 8 Judge Console | Stated "SQL probes only, no UI" everywhere (C-1, C-8). No UI built (not in scope today) | `README.md`, STATUS | Labelled |
| 9 R7 disagreement path | Stated as unexercised (C-7) | STATUS, README, deck outline | **DEPLOY** (one paid two-pass run on corruption 13) |
| 10 semantic view VQRs | Not built: cannot be validated offline. Marked "verified queries not built, 0 of 6" (C-12) | STATUS | **DEPLOY** |
| 11 skills | Not wired (no `upload_skills.sql`, no agent `skills:` block; too large to do unverified). Marked "4 definitions authored, not loaded" (C-3) | STATUS, README | **DEPLOY** + build |
| 12 STATUS contradictions | Restructured into A (current by component and account), B (dated log), C (20-23 Sept snapshot, labelled historical and per-row corrected). New `built` definition, account column, accounts paragraph (C-10, C-11, C-13, C-14, C-15) | `IMPLEMENTATION-STATUS.md` | Done |
| 13 two accounts | Documented OS69400 (current) vs JN89282 (historical) vs `KGTPGHJ-YJ28449` (earlier target); which account holds the submission build is not recorded | STATUS | **TEAM** to confirm |
| 14 hosting | Stated plainly as a limitation | README | **TEAM/DEPLOY** |
| 15 outbound MCP | Reworded: inbound only (C-19) | STATUS | Labelled |
| 16, C-16, C-17 competitor claims | Competitor source is **not in the repo** and citations are file-level only (no line numbers), so no file:line could be added. All "no competitor ..." / "nobody else ..." / "every competitor ..." statements in `planning/WINNING-PLAN.md` and `planning/revised-architecture/*.md` (11 files) were reworded to "not found in the competitor code we reviewed" with the limits stated; honesty banner added to `FINAL-VALIDATION.md` and `ps04-competitive-landscape.md`; README labels FINAL-VALIDATION historical | planning files listed in the diff | Done (softened, not cited) |
| 17 task dedupe bug | Not changed (SQL change needing deploy and paid run). Stated as open | STATUS, README | **DEPLOY** |
| 18 hygiene | Scrubbed the teammate key path from `docs/TESTING-PLAYBOOK.md` (now `<path-to-your-private-key-file>`). `snowflake.log` and `web/snowflake.log` are git-ignored (`.gitignore:13`, `web/.gitignore:34`) and untracked; not opened. `apollo-department-register.docx` **is tracked**: flagged, not removed (git index changes are not allowed). `frontend/pages/` still an empty directory | `docs/TESTING-PLAYBOOK.md` | Partly done; **TEAM** for docx |
| 19 counts | Absolute counts per account throughout (12 patients, 28 documents, 22 cohort PDFs, 68 assertions, 692 pages) | README, STATUS | Done |
| 20 CoCo provenance | Not fixable offline | - | **TEAM** |
| C-5 | Class B coverage "not yet measured" | README, STATUS | Done |
| C-20 | Circularity caveat added | README, STATUS, deck outline | Done |

## New finding (not in the judge evaluation)

`planning/research/patient-reality/real-patient-dipali.md` contains, derived from the 19 real reports, a patient name,
district, pincode, employer scheme, diagnosis and facility details. No scans are in the repo and nothing is loaded
into the system, but it is real-person health information in a public submission. It was **not edited** (the claim "synthetic
only in the system" remains accurate for the database; `docs/DATASET-LICENCES.md` states the exact position). **Team
decision needed before the freeze: redact or remove.**

## Remaining for the team or a Snowflake deploy

* TEAM: deck and demo video; redact/remove the real-patient note and the Apollo `.docx`; confirm submission account and
  CoCo session provenance; per-file reference licences; decide what to commit. There are many untracked and modified
  files (including `backend/sql/deploy/`, `evidence/qa/`, `docs/DATASET-LICENCES.md`, `docs/DECK-OUTLINE.md`) that are
  not in git; committing is the user's call (AGENTS.md section 1).
* DEPLOY: run the `backend/sql/deploy/00-09` bundle on a clean account and record query IDs; N4-03 two-user negative test
  on `DOC_PAGE`; R7 disagreement run; validator wiring; VQRs; skills upload; task dedupe fix and one scheduled run; run
  the 80 questions through `score_results.py` with a baseline.
