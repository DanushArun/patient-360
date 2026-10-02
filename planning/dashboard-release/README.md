# Dashboard release acceptance — 2 October 2026

Status: implementation in progress. No release acceptance has been granted.

## Target identity

Snowsight account details show organization-account `KGTPGHJ-YJ28449`, locator
`NY64016`, GCP region `me-central2.gcp`, signed-in user `DANUSH`.
The supplied URL is the same account. OS69400 deployment records are historical
and cannot prove this deployment. SQL identity verified `DANUSH / SAARTHI_APP`, secondary roles disabled.
Identity query: `01c77548-0003-dffe-0001-fe5a0013e0be`.

## Ownership and review

- GPT-6 Luna frontend: patient workspace, worklists, sections and responsive reading.
- GPT-6 Luna workflow: bounded contracts, source scopes, extraction lineage and validation.
- GPT-6 Luna independent QA: behavior, recovery, keyboard and browser journeys.
- Parent: dependencies, configuration, every production diff and final acceptance.

The latest 22-step storyboard controls appearance. The two designer PDFs control
navigation and recovery. Returned SQL data controls product facts and dates.
Fixtures remain explicitly recorded previews. They do not prove live completion.

## Gate record

[acceptance.json](acceptance.json) contains all 22 designer steps, X1–X6 and nine
release gates. Evidence and parent review are required for every pass.
Run `python3 tools/release_gate.py planning/dashboard-release/acceptance.json`.
An incomplete record exits nonzero. This validates the acceptance record;
it does not replace tests or prove that a submitted screenshot is correct.

## Verified results

- Final isolated working snapshot: 166 web tests, 117 backend/release-record tests,
  26 architecture checks, typecheck and production build passed. Full Playwright: 26/26.
  Evidence logs are in `evidence/`. Node dependencies came from a fresh locked install;
  the registry audit reported zero vulnerabilities. This is not a security guarantee.
- The visible Overview now contains the designer's evidence review table, current visit,
  record basis, seven patient sections, and persistent sidebar at the actual 897px pane.
  The unavailable live worklist offers an explicit recorded preview entry.
- The family lane now copies returned SQL checks and reasons, without generated timing,
  clinical instructions, or a local review-complete button. Language selection translates
  headings only; the original-language limitation appears in the UI and copied text.
- Browser checks cover preview switching, unavailable services, Origin, clipboard,
  keyboard, and responsive layout. They do not prove live consent, access, or saved writes.
- All base tables exist on YJ28449: [37-object inventory](evidence/yj28449-tables.csv).
  Query `01c7754d-0003-dffe-0001-fe5a0013e126`. No table/data reload performed.
- Dashboard read procedures are missing: query `01c77558-0003-db91-0001-fe5a0013cbf2`.
- Installed missing warehouse resource monitor: 2 credits, NEVER reset,
  SUSPEND_IMMEDIATE at 90%. Create query `01c7755d-0003-db91-0001-fe5a0013ccc6`.
  Warehouse resized to XSMALL, suspend 60s, statement limit120s/queue30s;
  alter query `01c7755d-0003-db91-0001-fe5a0013ccd2`.
  Monitor read-back `01c7755d-0003-db91-0001-fe5a0013ccde`: quota2, used0.
  This limits warehouse credits, not serverless AI/Search charges.
- Corporate CA resolved CLI TLS validation without disabling TLS. OAuth still
  fails with IdP/SAML error390190; application key-pair credential is absent.

## Parent review failures and repairs

1. 127.0.0.1 Origin rejected under Next's canonical localhost URL: constrained actual
   Host authority and loopback/configured origins; fresh independent browser regression passed.
2. Task-id read bypassed bound patient: nested ID lookup under patient-owned issue/
   readiness; source regression passed. Live two-patient proof still pending.
3. Packet recipient lacked current consent: matched recipient eligibility to active
   treating care team and recipient facility/org consent. Live refusal/packet proof pending.
4. Refusal/completion catches hid access withdrawal: preserve typed access errors;
   web behavior regressions passed.
5. Worklist view did not persist and initial save could overwrite restored filter:
   parent added restore-before-save plus view/filter/scroll storage tests, 4/4 passed.
6. New harmonization could double-convert canonical values based on support links:
   parent rejected it; Luna removed conversion and tightened unit/provenance eligibility.
   Source checks pass; SQL is not deployed or accepted.
7. Reference-scope Class A refusals previously accepted blank practitioner strings. The refusal
   context now requires non-empty practitioner ID, name, registration, binding, consent, and
   timestamp values; field-specific blank/whitespace regressions passed locally. Fixture tests do
   not prove the live YJ28449 referral binding or packet persistence.
8. The family checklist's generated seven-day timing could imply eligibility and an all-clear
   without returned record evidence. The lane now renders record-only checks. Local regression and clipboard tests pass;
   live handoff and reviewed translations remain pending.

9. Task fixtures incorrectly used invented gate shapes; actual SQL returns uppercase rows.
   Shared row normalization now handles the SQL envelope. Post-write access withdrawal
   propagates instead of becoming an unavailable-service message. Local tests pass.
10. GET refresh previously recomputed readiness. GET now reads the stored snapshot;
    explicit POST recomputes. A task save also reads stored readiness without evaluating.

## Open acceptance work

The six-procedure patch is prepared in Snowsight, not executed. Browser action-time
confirmation is pending because owner procedures inherit existing future grants.
The source snapshot is [deployment-plan.json](evidence/deployment-plan.json).
App-role runtime credentials must be configured privately before enabling dashboard live access.

Task creation still uses a permanent patient/rule/action key: replay after a previously
closed task is an unresolved acceptance risk. Live retry/concurrency proof is required.

Extraction into rule evaluation, persisted task read-back, exact citations,
reference metadata, revoked access, concurrent sessions and the complete independent
journey remain open. Existing CBC input lacks complete unit/provenance metadata
for the requested document-to-eligible-evidence demonstration. Do not invent it.
No preview, source scan, passing build or unit count can close these live gates.

Failure traces belong in `web/test-results/` and `web/playwright-report/`.
Parent acceptance has not been granted. The acceptance record must continue to fail
until every required journey and recovery branch is proved.
