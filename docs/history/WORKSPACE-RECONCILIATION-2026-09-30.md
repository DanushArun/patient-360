# Workspace reconciliation — 30 September 2026

**Historical pre-cleanup audit.** The user subsequently authorised cleanup and commits.
See [the resulting baseline](WORKSPACE-BASELINE-2026-09-30.md) for what was kept,
removed, corrected and deliberately deferred. Statements below about the dirty tree
and verification describe the initial audit, not the final baseline.

## Recommendation

Keep `web/` as the dashboard to develop and use. Preserve the governed SQL backend,
synthetic generators, contracts, tests, and evidence. Combine useful work by change,
not by replacing entire directories with another branch's contents.

No files were deleted, staged, committed, or merged during this audit. GitHub was
read through authenticated `gh`. The merged `main` snapshot was downloaded to a
temporary directory for comparison; local Git tracking refs were not refreshed.
This is a source and local-test audit, not verification of the deployed Snowflake account.

## What is actually current

- Local `main` and cached `origin/main`: `3cfd4e1`, 27 September.
- GitHub `main`: `9093efaa`, 28 September. Local tracking refs are stale.
- Local working tree: 13 modified tracked files plus untracked local-AI, evidence UI,
  research, classifier probes, and brainstorm artifacts.
- A retained stash at `stash@{0}` contains 16 lines of dashboard changes in two files.
  Do not drop it without comparing its patch with the final dashboard.
- The separate `/Users/danusharun/Documents/patient-360-backend` worktree is clean
  on `danush/backend-completion` at `4e95f4a`. Its backend changes are absent from main.

## Teammate work already merged: keep

| GitHub change | Useful code | Integration notes |
|---|---|---|
| [PR 3](https://github.com/DanushArun/patient-360/pull/3) | Multi-patient synthetic cohort/corruptions; `evidence/coco/testing_validation.yaml` | Already in local main. Retain failure-and-fix evidence. |
| [PR 5](https://github.com/DanushArun/patient-360/pull/5) | `data/generator/fhir_from_db.py`, `backend/scripts/generate_fhir_bundles.py` | FHIR generation/load path; deployed correctness was not retested here. |
| [PR 6](https://github.com/DanushArun/patient-360/pull/6) | `web/lib/snowflake.ts`, `web/lib/census.ts`, `web/app/page.tsx`, `web/app/census-search.tsx`, patient components/CSS | App primary role, accessible patient picker, actual practitioner name, search, error persistence, provenance and visual polish. Combine with local layout improvements. |
| [PR 7](https://github.com/DanushArun/patient-360/pull/7) | `backend/sql/setup.sql`, project overview, designer brief, testing playbook | Manifest removes committed conflict markers and enables implemented steps. Keep docs, but distinguish test plans from results. |
| [PR 8](https://github.com/DanushArun/patient-360/pull/8) | `web/app/navigator/[id]/`, `web/app/judge/`, `web/app/api/judge/route.ts`, patient schemes API; grants | Useful screen scaffolding, with correctness limitations below. Screen existence is not proof of six complete workflows. |
| [PR 9](https://github.com/DanushArun/patient-360/pull/9) | `web/lib/patient.ts` | Fixes a real clean-clone build failure caused by missing `.mjs` imports. Keep that reproducibility fix, but preserve the actual local adapter files separately. |

PR 9's description says `ASK_SAARTHI` performs classification. In the audited merged
source it remains a thin SQL wrapper calling `DATA_AGENT_RUN`, with no classifier
or answer-validator call. The guarded implementation is on `danush/backend-completion`.
The direct-call simplification needs that backend integration before it can be
claimed to enforce the full question/answer boundary.

## Valuable unmerged work: preserve before cleanup

| Branch / proposal | Useful files and behavior | Recommendation |
|---|---|---|
| `danush/backend-completion` (`4e95f4a`) | Guarded `backend/sql/agent/ask_saarthi.sql`; classifier; `evaluate_gates.sql`; reconciliation, refresh, parse and orchestrator tasks; rule/ontology/unit data; procedure grants; suspend/resume tasks; `backend/tests/test_ask_guard.py`, `test_evaluate_gates.py`, `test_reconcile.py`; `evidence/e2e/2026-09-24-live-runs.md` | High priority. Review and integrate backend changes selectively. A tip-to-tip replacement would remove `web/`, because this branch predates the dashboard; those apparent deletions are not a cleanup instruction. Check changed rules/tables against SPEC before adopting. |
| [PR 4](https://github.com/DanushArun/patient-360/pull/4), COM-11 branch | Server-side web census/context/review procedures; binding release; `web/lib/session-security.ts`, `request-auth.ts`, `web/proxy.ts`, session tests | Preserve. Review authentication and live access behavior before claiming isolation is proven. App role alone does not supply separate browser-user identity. |
| COM-22 dashboard branch (`2e35b54b`) | Includes session work above, plus `web/lib/snowflake-config.ts`, accessible errors/UI changes, behavior/accessibility tests, expanded dashboard README | Preserve and reconcile once; avoid applying overlapping COM-11 changes twice. Remote comparison shows eight commits ahead and thirteen behind main. |
| [PR 10](https://github.com/DanushArun/patient-360/pull/10), closed without merge | Environment-based Snowflake account/user/key path and explicit warehouse in `web/lib/snowflake.ts` | Useful setup improvement. Prefer the more complete COM-22 config where appropriate; audit defaults before adopting. Closed does not mean redundant. |
| [PR 11](https://github.com/DanushArun/patient-360/pull/11), open | Updated `docs/DESIGNER-BRIEF.md`, `TESTING-PLAYBOOK.md` | Keep as documentation work to reconcile after final screens. |

Other old deployment/evaluator branches largely represent earlier work. Retain
their refs until the final integrated tree is checked; do not infer redundancy
from branch names or commit dates alone.

## Every local change: keep, repair, or exclude

| Local files | Decision | Reason |
|---|---|---|
| `web/lib/local-ai.mjs`, `local-ai-tools.mjs`, `local-ai-artifact.mjs`, `local-ai.d.mts`, four `local-ai*.test.mjs` files; `local-ai/` | Preserve as optional development provider | Bounded Snowflake tools, SQL classification, rejected patient selectors, typed claims and SQL validation. 29 combined adapter/readiness tests pass. Mock tests do not establish deployed parity. Commit the complete dependency set together if retained. |
| `web/lib/question-routing.mjs`, `record-answers.mjs`, `record-answers.test.mjs` | Preserve for review; avoid making this the canonical answer path | Classification delegates to SQL; these are server-side modules, so their mere existence is not an R5 violation. However JS selects readiness intent/state summaries; R1 calls for SQL-derived states. Record-state and clinical-refusal handling also needs alignment with the guarded SQL entry point. |
| `web/app/patient/[id]/patient-answer-artifact.tsx`; artifact insertion in `patient-evidence.tsx` | Keep with complete adapter integration | Displays claims, limitations and separate corpora. Without artifacts being returned, this panel has no content. |
| Local `patient-client.tsx`, `patient-evidence.tsx`, `globals.css`, `saarthi.css` | Keep useful hunks | Better gate card wrapping, sticky evidence panel with smaller-screen fallback, useful error messages. Combine with teammate links, provenance, persisted errors and polish. Browser verification remains outstanding. |
| `web/package.json` | Keep test command, improve scope during integration | `test:local-ai` currently excludes `record-answers.test.mjs`; audit ran it explicitly. No dependency change in this local diff. |
| `backend/sql/procedures/tools/01_get_patient_facts.sql` | Keep three-clock addition | Adds `source_recorded_at` and `ingested_at` to lab results. Check payload compatibility with adapter canonicalization: it reads numeric `value`, while this procedure returns numeric `value` and text `value_text`. |
| `backend/sql/procedures/classify_question.sql`, `backend/sql/probes/question_classification.sql` | Keep intent, repair and test before deploying | Expanded record-state wording is useful, but keyword order/regex risks misclassifying the probe “What is wrong with this patient's record?” as clinical because `patient` ends at a word boundary before the apostrophe. Reconcile with backend-completion's classifier rather than overwriting it. |
| `backend/sql/agent/saarthi_agent.sql`, `frontend/contracts/tool_signatures.yaml` | Keep selector reduction; repair agent instruction indentation | Removing agent-facing encounter selection reduces reachable scope. The local `orchestration: >` is indented inside the folded `response` string instead of being a sibling key. Verify resource/procedure signature compatibility before deployment. |
| `frontend/core/design.py`, `frontend/streamlit_app.py` | Hold; exclude current wrapper hunks from integration pending proof | New `st.html` opening tags do not demonstrate wrapping separately rendered Streamlit columns. No browser evidence establishes this layout change helps. Keep the underlying Streamlit app and core modules. |
| `backend/SAARTHI Live Build.html` | Keep rendering fixes; rewrite status data | Removes unavailable `claude.use('db')` dependency; fixes font measurement/theme rendering. Hardcoded September snapshots labelled “now” are historical evidence, not live telemetry. Reconcile with teammate updates instead of carrying stale claims forward. |
| `planning/research/README.md` and two 24 September workflow/code-review research files | Keep as research | Independent context/provenance; not runtime code and not redundant just because dashboard starts without them. |
| `.superpowers/` | Cleanup candidate | Scratch brainstorm HTML and stopped-server/PID artifacts. Preserve any design decisions not captured elsewhere, then exclude/remove scratch outputs. |

## Actual blockers and limitations

1. Local `backend/sql/setup.sql` contains conflict markers around lines 211–247.
   They are already in the committed base, so `git diff --check` does not catch them.
   The remote merged manifest fixes them. The mechanical manifest check nevertheless passes:
   it verifies referenced paths, not valid deployment syntax.
2. Local connector uses primary `ACCOUNTADMIN`; merged main changes it to `SAARTHI_APP`.
   Both disable secondary roles and use fresh per-request sessions. Both still use one
   hardcoded Snowflake identity and lack a configured warehouse in that connector.
3. Merged Judge probes 3 and 4 return one `COUNT(*)` row, even when the count is zero,
   but their pass logic checks `rows.length === 0`. They will report failure on healthy
   zero counts. Probe 6 always passes and does not attempt a denied bind. These are
   useful probes to fix, not verified security acceptance tests.
4. Navigator computes a seven-day preparation date in JS and maps gate results to
   instructions in the browser. Move rule-derived dates/instructions to the versioned
   SQL path for R1 compliance. Scheme API failures become `[]` in the UI, displayed as
   “No eligible schemes found”; this conflates unavailable evidence with a negative result.
   The schemes API also returns uncertain statuses, not only eligible schemes.
5. Scheme SQL uses coverage/state proxies. Do not present proxy eligibility as verified
   government authorisation. No current legal/clinical policy assessment was performed here.
6. Live Snowflake privileges, deployed procedure versions, complete document ingestion,
   reference retrieval and browser workflows were not verified by this audit.

## Cleanup categories

- Remove/exclude after preserving decisions: `.superpowers/` brainstorm/server artifacts.
- Disposable ignored build cache: `web/.next/` (885 MB at audit time). Rebuildable;
  clearing it is optional and has no effect on tracked code. `web/node_modules/` is
  also ignored (608 MB), but retaining it avoids reinstalling to start the dashboard.
- Archive candidates, not immediate deletion: `frontend/_superseded/` (five old page
  scripts), `scratch_live_demo/live_demo.py`. Inspect historical references before removal.
- Preserve historical evidence: `planning/archive/`, v1 planning docs explicitly labelled
  superseded, CoCo query IDs/failure-and-fix records, clinical sources and synthetic fixtures.
- Preserve `frontend/core/`, `frontend/contracts/`, `frontend/tests/` and the Streamlit
  entry point. They contain reusable contracts/tests and a working alternative interface;
  choosing Next.js does not make them redundant.
- Preserve `.env.local` and local credentials privately; do not add them to a publish set.
- Do not delete other worktrees, branch refs or the stash as part of file cleanup.

## Fresh verification results

| Command | Observed result |
|---|---|
| `node --test web/lib/local-ai*.test.mjs web/lib/record-answers.test.mjs` | 29 passed, 0 failed; mocks, not live backend proof |
| `cd web && ./node_modules/.bin/tsc --noEmit` | Exit 0 on current local tree |
| `.venv/bin/python -m pytest -q` | 210 passed, 1 failed: `test_chat_input_disabled_until_a_patient_is_bound` finds no chat-input widget |
| `.venv/bin/python backend/scripts/check_gate.py --all` | 18 passed, 8 preamble failures, 0 skipped; drift/missing marker findings require review, not automatic proof of access bypass |
| `git diff --check` | Exit 0; does not inspect committed manifest conflicts |

The system Python lacks `pypdf`, `jsonschema` and Streamlit, so its initial test collection
failed. Use the existing `.venv`; that avoids mistaking environment errors for product failures.
No production build, live account test or browser acceptance run was performed.

## Integration order for today's setup

1. Preserve a recoverable copy of the full dirty tree, untracked adapter dependencies and
   stash; record the branches above. Choose latest GitHub main as integration baseline.
2. Reconcile backend-completion changes first, including guarded questions/answers,
   rules, reconciliation, scheduling and least-privilege grants. Preserve new FHIR work.
3. Reconcile COM-22/COM-11 session and dashboard work once; preserve teammate Navigator,
   Judge and census changes. Apply environment/warehouse configuration.
4. Add selected local layout/error/evidence improvements. Keep Ollama an optional provider
   with its complete source/test/docs set; avoid duplicated canonical routing.
5. Repair the named classifier, agent YAML, Judge and Navigator issues. Refresh status
   docs from test evidence, not optimistic screen counts.
6. Run relevant local tests/build, then synthetic live account and browser acceptance.
   Start dashboard using `cd web && npm run dev`; Ollama is needed only for its provider.
7. Remove only agreed scratch/obsolete files. Stage, commit and push only within the
   repository's explicit Git authorisation rules.

This report recommends the concrete preservation and cleanup set. It does not claim
the reconciled setup has been implemented or is ready for clinical use.
