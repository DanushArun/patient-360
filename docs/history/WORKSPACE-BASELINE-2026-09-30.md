# Committed development baseline — 30 September 2026

This baseline reconciles valuable working-tree changes with the merged GitHub
snapshot `9093efaa`, using ordinary file edits. It does not merge or rewrite
branches and does not deploy SQL or push to GitHub.

Publication follow-up: Danush subsequently authorised pushing the four cleanup
commits and handling incoming work. The four changes were applied to remote
`main` at `9093efaa`, preserving its twelve previously missing commits in the
publication ancestry. The resulting files were compared with the original
reviewed baseline and matched exactly before this publication note was added.
The original local commits remain preserved; publication uses a normal
fast-forward push. This follow-up does not deploy SQL or change the live-access limits.

## Retained and reconciled

- Teammate FHIR generation and twelve synthetic bundles; project/design/testing docs.
- Merged census search, accessible-patient picker, practitioner context, Navigator,
  Judge, provenance labels and persisted error turns.
- Complete optional Ollama provider, all bounded tool modules, typed evidence
  artifacts, matching tests and public env examples. No key or private env file is committed.
- Local gate wrapping/sticky evidence improvements and visit/regimen/cycle context
  recovered from the retained stash. The stash itself remains available.
- Synthetic fixtures, contracts, Streamlit core/current entry point, clinical-source
  evidence, architecture/planning history and other worktrees.

## Precise removals

- `.superpowers/` brainstorm/server scratch outputs, now ignored.
- Five `frontend/_superseded/*.py` pages, replaced by the current Streamlit surface.
- `scratch_live_demo/live_demo.py`, an obsolete entry point with a shared cached connection.
- Five unused Next.js sample SVGs in `web/public/`.
- Untracked `web/lib/record-answers.mjs` and its tests: duplicate JS readiness routing
  has no remaining caller; both providers now use SQL classification and their canonical path.
- Unproven unmatched `st.html` wrapper hunks were discarded; current Streamlit code was preserved.

Tracked deletions remain recoverable from commit `3cfd4e1`. Pre-cleanup dirty patches,
untracked source archive, obsolete-file archive and stash patch are additionally in
`/private/tmp/patient-360-*20260930*`. These temporary archives are not permanent storage.

## Focused corrections

- Fixed manifest conflict markers and made the manifest checker reject them.
- Kept agent-facing encounter selectors absent and repaired YAML instruction structure.
- Fixed patient-versus-patient-record routing and conservative dose-related refusal;
  probes and regex/YAML regression checks accompany the changes.
- Six bound-patient tools now share the canonical query-time care-team/consent preamble.
  Reference-only search and unbound cohort use separately checked exceptions.
- Changes include all three clocks. Review-task scope is checked before replay/write;
  a same-key replay must match the issue and actor, and NULL actions/keys are rejected.
- Binding release uses a caller/session-scoped owner's-rights procedure instead of raw UPDATE.
- Judge count probes inspect aggregate values, consent inventory is informational,
  and returned query IDs are displayed. These probes are not full security acceptance tests.
- Snowflake identity/warehouse configuration comes from private environment settings;
  primary role remains `SAARTHI_APP`, secondary roles disabled.
- The obsolete Streamlit chat-input test now checks the intended absence of unbound chat.
- Webpack is the supported production build default after recording Turbopack's local-port failure.
- Static build HTML is explicitly a historical snapshot, not live telemetry.
- FHIR export escapes patient IDs, source IDs and JSON as SQL literals; synthetic
  regressions cover quote/backslash handling, zero values, ordering and distinct clocks.

## Valuable branches deliberately not activated

`danush/backend-completion` (`4e95f4a`) remains committed in its clean separate worktree.
It contains useful guarded-answer/reconciliation/rule/scheduling work, but review reproduced
unsupported guard acceptance and positive/negative reconciliation agreement. It also expands
to thirty rules and a new regimen registry outside the current sixteen-rule SPEC.
Preserve and correct it rather than silently activating it during cleanup.

COM-11 (`4525b29`) and COM-22 (`2e35b54`) preserve per-professional authentication,
owner-procedure reads and dashboard tests. Their overlapping changes require a focused
integration and live grants check. No worktree or branch ref was deleted.
PR 10's environment/warehouse improvement is represented in this baseline's config module.
PR 11's open documentation update remains preserved on its remote branch.

## Verification and limits

Local tests are engineering checks on synthetic fixtures, SQL/YAML source and mocked
tool results. They do not prove SQL compilation, deployed access policies, clinical
validation, complete ingestion or a clean-account end-to-end deployment.

Read-only account probe on 30 September authenticated successfully with role
`SAARTHI_APP` and warehouse `SAARTHI_AI_WH`. Five of five attempted table reads returned
Snowflake `002003` (object unavailable/not authorised): `CORE.PATIENT`, `CORE.ENCOUNTER`,
`OPERATIONAL.READINESS_STATE`, `GOVERNANCE.PATIENT_BINDING`, `OPERATIONAL.DT_SCHEME_ELIGIBILITY`.
The probe did not change account state. Therefore the local dashboard build is testable,
but its live data views are blocked under the configured app role.

The committed role grants lack direct table reads while dashboard code still contains
some SELECTs. Complete the preserved owner-procedure integration and deploy/reverify
the app-role procedures before calling the live dashboard ready. Do not restore ACCOUNTADMIN.
The updated consent/release/write procedures have not been deployed in this cleanup.

Additional retained limitations: one local Snowflake identity for browser visitors;
the default thin `ASK_SAARTHI` lacks the deferred answer guard; direct MCP/procedure paths
do not establish the app's Class A routing; persistent practitioner-addressed refusal
packets are unfinished; Navigator date/instruction mapping and scheme proxies remain partial.

Use `web/README.md` for startup and verification commands.

| Check | Result on 30 September |
|---|---|
| Full Python suite | 235 passed, 0 failed |
| Web Node tests | 32 passed, 0 failed |
| Strict source/contract gate | 26 passed, 0 failed, 0 skipped; 55 deploy paths resolve |
| TypeScript | Passed |
| Production Webpack build | Passed |
| Playwright Judge smoke | Eight intercepted synthetic probes; desktop/mobile; zero browser errors |
| Whitespace check | Passed |
| Independent cleanup review | No remaining blocking findings |
| Live app-role table reads | 0 of 5 succeeded; access remains blocked |

Browser fixtures verify rendering and result handling, not live SQL probe outcomes.
The FHIR export tests verify synthetic construction and quoting, not FHIR conformance
or a live ingestion round trip. Reconciliation/review-task concurrency also remains unproven.
