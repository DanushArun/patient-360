# Prototype setup and Snowflake cost controls

Use the recorded design preview for frontend work and enable live Snowflake only
for deliberate integration tests. The trial screenshot shows a **$400 balance**,
not 400 compute credits. An environment file is not an account spending cap.

## Latest checkpoint — 1 October 2026, after approved integration tests

This section supersedes the older checkpoints below. The app now uses
`SAARTHI_APP`; the local administrator override is off. Hosting is deferred.
No new patient details, clinical rules or application tables were added.

- Installed the two access-checked frontend read procedures, task transitions,
  one-patient readiness saving and the task-creation safety fix. App-role reads
  returned 12 patients and the expected stored results; direct table access was
  denied (`01c76fa9-0003-dffe-0001-fcae000da822`).
- The existing approved Gopal Das task was acknowledged, reassigned to its same
  eligible owner and resolved with an explicit test note. Each retry returned the
  same saved action; three action receipts were read back. Query IDs: acknowledge
  `01c76fac-0003-db91-0001-fcae000dc406`, reassign
  `01c76fac-0003-db91-0001-fcae000dc462`, resolve
  `01c76fac-0003-dffe-0001-fcae000daa8e`. Only one eligible practitioner existed;
  reassignment between different people is not verified.
- All 12 before/after clinical results were unchanged after matching by rule ID
  (`01c76fad-0003-dffe-0001-fcae000dab22`). An initial comparison failed because
  SQL returned a different array order, not different results. A separate initial
  task test found an unbound SQL variable; it was corrected before the successful
  test. Neither failure is evidence of a clinical-result change.
- Installed pointer-only answer history, a practitioner-addressed packet marked
  prepared/not delivered, the one-document extractor and both Search scope fixes.
  Installation does not establish successful UI saving; those checks remain.
- Tested only the existing `data/generated/pdf/EVT-HER2-SURGICAL` report, one page.
  One parse and two independent extraction calls (Llama 3.3 70B and Claude Haiku
  4.5) produced a verified HER2 IHC `2+` assertion at character offsets 164–176.
  Extractor query: `01c76fb7-0003-dffe-0001-fcae000daff2`; verification:
  `01c76fb7-0003-db91-0001-fcae000dc91e`. Both models read the same parsed text;
  this is not independent verification of the PDF image.
- Patient Search returned that page, and scoped source-text retrieval matched it
  exactly (`01c76fb7-0003-dffe-0001-fcae000dd05a`,
  `01c76fb7-0003-db91-0001-fcae000dc926`). Binding to Gopal blocked that other
  patient's document (`01c76fb7-0003-db91-0001-fcae000dc942`). The reference
  corpus was empty: no real reference-document retrieval was verified. Existing
  SQL readiness ran separately; the test did not make the new assertion change a
  gate or verify a complete guarded answer on screen.
- Both Search services ended with **indexing and serving suspended**, verified
  by `01c76fb7-0003-dffe-0001-fcae000dd166`. Scheduled tasks and dynamic tables
  were not resumed. Interactive Search requires a deliberate, budgeted resumption;
  do not present suspended Search as continuously available.
- The monitor reported **0.76 of 2 warehouse credits used at the start** of the
  document test. This is not a final total or remaining trial-dollar balance;
  reporting lags and excludes serverless AI/Search and storage.
- Local verification: **49 web tests, TypeScript and production build passed**.
  The readiness action was made visible at narrow widths and checked in-browser.

Still open: complete UI save/reload testing for readiness, answer history, packets
and source links; navigator timing/languages; revoked-consent/role/concurrent-session
regressions; complete answer validation; the old batch reconciliation pipeline;
real reference retrieval; different-owner handoff; and clean-account deployment
of the new procedure files (not yet included in `setup.sql`). The baseline smoke
script predates Search creation and intentionally stops if services exist; do not
rerun it as a current full-E2E check. The one-document script refuses re-ingestion
of the tested document to avoid repeating paid extraction. Hosting and per-user
login are deferred by the user. Judge Console remains excluded.

## Verified account bootstrap — 1 October 2026

The user selected **OHCXVXM-OS69400** (locator **JR18576**) after reporting that
the teammate account's credits were exhausted. Local OAuth authenticated as SITAR;
the matching existing RSA public key was registered without replacing another key.
JWT authentication was subsequently verified by the SQL deployment connection.

- Created `SAARTHI` and the seven project schemas.
- Created `SAARTHI_AI_WH`, X-Small, initially suspended, auto-suspend 60 seconds,
  auto-resume enabled, statement timeout 120 seconds, queue timeout 30 seconds.
- Attached `SAARTHI_PROTOTYPE_LIMIT`: **2 compute credits**, `FREQUENCY=NEVER`,
  `SUSPEND_IMMEDIATE` at **90%**. This is not a dollar cap or a guarantee against
  overshoot. It does not cover Cortex AI/Search serverless charges.
- Did not enable account-wide AI inference, create Search services, or invoke AI.
- At bootstrap, the web environment was disabled pending integration checks.
  The subsequent user-requested local recording exception is documented below.

The original 2-credit `FREQUENCY=NEVER` monitor above is historical bootstrap
state. On 3 October, the user approved a bounded increase to **3 credits**
with the same 90% immediate-suspend trigger. The matching code guards and an
account-pinned migration script are prepared, but fail-closed OCSP verification
stopped the local connection before the current setting could be read or
changed on this machine. Until
the migration is run and verified on the connected laptop, do not claim that
Snowflake's live monitor is 3 credits. See `backend/extraction/README.md`.

Evidence query IDs: key registration `01c76f43-0003-e025-0001-fcae000d50c6`, monitor
creation `01c76f43-0003-dffe-0001-fcae000d9036`, warehouse creation
`01c76f43-0003-db91-0001-fcae000d312e`, and suspended-warehouse verification
`01c76f44-0003-e025-0001-fcae000d50d2`.

The account-pinned scripts `backend/scripts/bootstrap-os69400.mjs` and
`backend/scripts/deploy-prototype-os69400.mjs` print a plan by default. The latter
requires the exact plan SHA256 before applying it and can resume a bounded step
range. It excludes Judge Console, defers Search and AI calls, and keeps scheduled
processing suspended. Do not repeatedly bootstrap or reset the monitor quota.
Completed deployment is distinct from a successful live frontend E2E test.

### SQL-only deployment and smoke result

All 218 statements in the inspected prototype plan completed successfully. The
plan deferred agent/MCP grants until those objects existed and uploaded the four
existing synthetic facility CSVs before COPY. No patient data was invented.
The confirmed data counts are **12 patients, 16 rules, and 137 clinical events**.
Seven tasks were verified suspended; no Cortex Search service was created.
Four deterministic dynamic tables were initialized once and explicitly suspended.
Agent and MCP definitions exist, but no agent invocation or document extraction
was performed. Readiness materialization remains deferred; the smoke invoked the
SQL evaluator for one bound patient, not the all-patient refresh procedure.

The SQL smoke ran as `SAARTHI_APP`, with secondary roles disabled, and passed:

| Check | Query evidence |
| --- | --- |
| Counts of existing project records | `01c76f4a-0003-db91-0001-fcae000d32a2` |
| Authorized binding of PAT-DC-07 | `01c76f4a-0003-e025-0001-fcae000d5246` |
| Readiness: 12 applicable rule results | `01c76f4a-0003-e025-0001-fcae000d525e` |
| Timeline procedure | `01c76f4a-0003-e025-0001-fcae000d52ea` |
| Other patient's encounter rejected: binding_mismatch | `01c76f4a-0003-dffe-0001-fcae000d9192` |
| Released binding rejected: no_patient_bound | `01c76f4a-0003-dffe-0001-fcae000d91ae` |
| Final warehouse state: SUSPENDED | `01c76f4a-0003-dffe-0001-fcae000d91ba` |

Direct SELECT on the patient table was correctly denied to `SAARTHI_APP`.
This confirms why the frontend's remaining direct-table reads fail under
`SAARTHI_APP`. Normal least-privilege operation still needs the owner-procedure
integration; the user separately authorized the legacy admin recording path.

The monitor reported **0.05 compute credits used** after this deployment and
smoke (`01c76f4a-0003-e025-0001-fcae000d5306`). Reporting can lag; this is not an
exact dollar charge or a statement of the remaining trial balance. No AI model
or Search service was invoked. Full frontend/document/AI E2E remains pending.

Authentication note: an initial SAML/external-browser attempt failed with 390190
before any changes. Local OAuth Authorization Code then succeeded. TLS validation
remained enabled with `NODE_USE_SYSTEM_CA=1`; no insecure certificate bypass was used.

## Local protections

- `web/.env.local` is ignored by Git. Keep its file permissions at `600` and keep
  private keys outside the repository. Never paste a private key into chat.
- `SAARTHI_SNOWFLAKE_ENABLED=false` blocks connections before key loading. Only
  the exact value `true` enables them. Missing settings also fail closed.
- `/design-preview/PAT-DC-07` uses recorded project data, not live results. Live
  routes fail explicitly while access is disabled; there is no fixture fallback.
- Every web connection disables secondary roles, normally uses `SAARTHI_APP`, applies a
  120-second statement timeout and 30-second queue timeout, and tags queries
  `saarthi_web_prototype`. These limits apply per SQL statement, not per day or
  dollar. A request can execute several statements. They do not govern work
  submitted by other clients or independently running services.
- The warehouse creation script now starts new warehouses at `XSMALL`, suspended,
  with 60-second idle suspension. `CREATE IF NOT EXISTS` does not alter an existing
  warehouse, and performance at this size still needs live measurement.

These protections do not change clinical rules, verification passes, consent
checks, model families or retrieval scoping.

## Confirm the account before connecting

Resolve any mismatch between a supplied account locator and the account in the
Snowsight URL. In the intended account, copy **View account details** or run:

```sql
SELECT CURRENT_ACCOUNT(), CURRENT_REGION(), CURRENT_USER();
```

Use the full organization/account identifier, or the full region-qualified
locator, for `SNOWFLAKE_ACCOUNT`. The format for a locator in GCP Dammam is
`<locator>.me-central2.gcp`. See [Snowflake account identifiers](https://docs.snowflake.com/en/user-guide/admin-account-identifier).

The web app needs an application username, a local JWT private-key file and the
matching registered public key. Browser sign-in alone does not configure that
connection. Shared/production web access must not use the account administrator.
The default primary role is `SAARTHI_APP`; the explicit single-operator recording
exception below is not a production authentication design.

## User-requested legacy recording mode

The user requested the earlier frontend's direct-table behavior for recording.
`SAARTHI_LOCAL_RECORDING_ADMIN=true`, together with live access enabled, selects
`ACCOUNTADMIN` **only in development mode**. It fails closed in production/test
or when `NODE_ENV` is absent. An arbitrary `SNOWFLAKE_ROLE` cannot elevate access.

Run `NODE_USE_SYSTEM_CA=1 npm run dev:recording` from `web/`. That command binds
to `127.0.0.1`, not the LAN. Never publish or tunnel this server. Credentials stay
in the ignored local environment and external private-key file. Current-user
care-team/consent filtering and per-request patient binding remain, but this mode
is **not proof of least-privilege isolation**: the session has admin privileges.

Use `/` and `/patient/PAT-DC-07` for real Snowflake records. The design-preview
route is still a fixture. The review queue was a local workflow preview at that
checkpoint; the subsequent live-read integration is documented below.
Switching roles does not make document extraction, AI answers, or queue persistence
complete. Do not record these as working live unless separately verified.

### Recording-mode verification — 1 October 2026

The current local environment now enables live access with the explicit recording
override. The listening address was verified as `127.0.0.1:3000` (not `*:3000`).
The normal `SAARTHI_APP` configuration and production rejection are unit tested.

- The initial all-encounter refresh hit the 120-second statement timeout. It had
  already committed 255 results for 18 encounters; no timeout or monitor was raised.
- Resumed only the one missing encounter (`EVT-CHEMO-07`), invoking the existing
  `EVALUATE_GATES` and reusing the exact MERGE from `tasks/refresh_readiness.sql`.
  No rule, value, threshold, patient, or encounter was invented or changed.
- Final stored snapshot: **271 rule results, 12 patients, 19 encounters**.
  Query evidence: evaluator `01c76f66-0003-e025-0001-fcae000d5352`, MERGE
  `01c76f66-0003-dffe-0001-fcae000d9c0e`, final counts
  `01c76f66-0003-dffe-0001-fcae000d9c12`.
- HTTP 200 with real patient data: `/`, `/patient/PAT-DC-07`,
  `/navigator/PAT-DC-07`, and `/history/PAT-DC-07`.
- Live patient APIs: 12 readiness checks, 11 timeline events, one scheme row,
  and an empty review-task history for `COV-AUTH-001` (not fabricated tasks).
- An unknown/unauthorized patient request returned HTTP 403 with
  `bind failed: no_patient_access`, without a patient name. The clinical-judgment
  question returned the existing refusal with zero agent tools.
- One browser copilot request, “Show me the COV-AUTH-001 readiness result.”,
  successfully invoked `GetReadiness`, returned the actual coverage conflict,
  and displayed its SQL evidence. Tool query ID:
  `01c76f69-0003-dffe-0001-fcae000d9e22`. No source document IDs were returned
  for that gate; the interface explicitly states this rather than inventing citations.
- Local checks: **35 tests passed**, TypeScript passed, production build passed.
  The live header was also checked in the narrow browser panel and adjusted to
  wrap actions without squeezing patient identity.

This proves the recorded SQL-backed path and one copilot question, **not complete
document-to-answer E2E, review queue persistence, or production access isolation**.
Search and document extraction remain deferred. No scheduled jobs were resumed.
The post-refresh monitor reported 0.11 warehouse credits used; subsequent frontend
checks add usage, and the single AI request is billed separately from that monitor.

### Live Review Queue — 1 October 2026

The queue now reads live Snowflake tables rather than recorded JSON. Three
bounded, independently scoped reads returned **12 accessible patients and 24
readiness items**, with no missing selected-visit readiness and initially no
review tasks. Names, patient/encounter IDs, SQL outcomes, reasons and dates are
not substituted or joined by name. Query IDs:

- Patient scope: `01c76f89-0003-db91-0001-fcae000d3a0a`.
- Stored readiness: `01c76f89-0003-e025-0001-fcae000d5c8a`.
- Task ownership/state: `01c76f89-0003-dffe-0001-fcae000da19e`.

Browser verification confirmed the 12-name sidebar, 24-item queue, search-empty
state, Gopal Das filter, and navigation to `/patient/PAT-DC-07` rather than a
design preview. The long fixture banners were removed; the offline-only design
route retains a small Design preview identifier. Live pages have no preview label.

The queue reads existing SQL snapshots and exposes their per-result `known_as_of`.
It does not claim to recompute all gates when Refresh queue is clicked. Scheduled
readiness refresh remains suspended for cost control; underlying data changes
require a deliberate refresh before the stored results update. Queue navigation
prefetch is disabled. No deployment, AI call or background-job activation was
needed for this change. Unit checks: **49 web tests passed**, TypeScript passed.

The pre-verification monitor reported **0.41 of 2 warehouse credits used**
(`01c76f89-0003-e025-0001-fcae000d5c86`). This can lag and excludes serverless
AI/Search, storage and subsequent queries; it is not the remaining dollar balance.

The initial browser write was blocked before submission pending explicit approval.
After the user approved this exact synthetic test, Gopal Das / `PAT-DC-07` /
`COV-AUTH-001` was escalated through the patient UI. Task
`e6b29512-46e2-4ba2-a691-4a818208e210` persisted as `open`, decision `escalate`,
owner `Dr. Test Oncologist`. A second click returned **Task already filed** with
the same ID. Independent scoped SQL read-back found exactly one matching task
(`01c76f8e-0003-db91-0001-fcae000d3d8e`). The live queue's Assigned task filter
then showed that same patient/rule, owner and state. The approved record remains
in the prototype account; no clinical result was changed.

The final monitor read reported **0.49 of 2 warehouse credits used**
(`01c76f8e-0003-db91-0001-fcae000d3d92`), subject to the same lag and exclusions.
No AI request or full redeployment was used. This verifies one escalation save,
retry and read-back, not every task action or access-control failure path. The
current `CREATE_REVIEW_TASK` procedure supports filing, but even its `close`
action inserts an open task; resolution/reassignment lifecycle work remains.

Remaining beyond queue reads: complete document → parse → two-family extraction
→ verified evidence → SQL rule → cited answer on this account; Search/source-page
verification; approved least-privilege reads and per-user authentication before
hosting; role/revoked-consent/concurrent-session regression coverage; persistent
answer/clinical-referral packet workflows; navigator timing, scheme-proxy and
language/copy checks. Judge Console remains excluded.

## Account controls and remaining verification

First inspect the existing deployment and settings; do not deploy a second copy
or replace an existing resource monitor to get past a limit:

```sql
SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH';
SHOW RESOURCE MONITORS;
SHOW CORTEX SEARCH SERVICES IN DATABASE SAARTHI;
SHOW TASKS IN DATABASE SAARTHI;
SHOW DYNAMIC TABLES IN DATABASE SAARTHI;
```

If `SAARTHI` does not exist, stop and plan the one-time deployment. These metadata
checks do not initialize a schema or invoke the AI pipeline.

Settings to verify for each account (warehouse settings and the monitor above
have been applied only to OS69400; Search and live AI testing remain deferred):

1. Set the dedicated existing warehouse to `XSMALL`, `AUTO_SUSPEND=60`, and
   `AUTO_RESUME=TRUE`. Avoid changing a warehouse shared with unrelated work.
2. Attach a warehouse resource monitor with an agreed credit quota, notifications
   and immediate suspension below the quota (for example at 90%). Determine the
   quota from the account's actual dollar-per-credit rate and reserve trial funds
   for AI, search, storage and the submission. Do not interpret `$400` as a
   `CREDIT_QUOTA=400` setting. Preserve existing stricter monitors and enable
   notification delivery. Monitors can overshoot and do not cover all serverless
   usage: [resource monitor limits](https://docs.snowflake.com/en/user-guide/resource-monitors).
3. For both existing Cortex Search services, consider `AUTO_SUSPEND=1800` after
   confirming account support. This suspends **serving only** after inactivity,
   not indexing, and queries wake serving again. For a planned offline interval,
   suspend both layers explicitly. Paused indexing means stale results; suspending
   beyond source retention can require rebuilding. Check retention and successful
   refresh before presenting live results again. See [Cortex Search controls](https://docs.snowflake.com/en/sql-reference/sql/alter-cortex-search).
4. Inspect tasks and dynamic tables before enabling schedules. Keep unused
   prototype background work suspended, and restore only the required dependency
   chain for integration tests. Capture the initial state; do not blindly resume
   every task or describe suspended snapshots as current.
5. Check Snowsight cost management before and after test sessions, including AI
   and search usage, and allow for reporting delay. Start with one existing
   synthetic patient and one bounded record question, not batch extraction,
   load testing or a full model-availability sweep.

Warehouse idle suspension and the local connection switch do not stop background
Search services, scheduled work or storage billing. Stopping the laptop is not a
Snowflake shutdown. A guaranteed global dollar cap has **not** been established.

## Normal development and demo startup

Run `npm run dev` from `web/` after installing dependencies once. Restart the local
server after configuration changes if necessary. This starts a local process; it
does not require redeploying Snowflake. Closing that process or restarting the
computer means starting it again. Permanent frontend hosting is separate work.

Only set `SAARTHI_SNOWFLAKE_ENABLED=true` after the identity, privileges and account
controls are verified. Return it to `false` for design work. Existing in-flight
queries and background services must be handled separately; this is not an
emergency account shutdown switch.

Use a single backend deployment only if the confirmed account lacks the required
objects. Later backend changes need their specific migration, not routine full
setup or teardown. Repeated idempotency/teardown rehearsals belong in an explicitly
budgeted disposable environment.

Successful local tests alone do not establish live connectivity or a complete
clinical workflow. The bounded live checks above verify the single-operator
recording path only. Clean-account grants and owner-procedure read integration
described in [the web README](../web/README.md) still need verification before
normal least-privilege or shared/production operation.
