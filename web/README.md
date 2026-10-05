# SAARTHI dashboard development

Use Node.js 20 or newer. From this directory:

```sh
npm ci
cp .env.example .env.local
# Fill in your synthetic-development Snowflake identity and key path.
# Leave SAARTHI_SNOWFLAKE_ENABLED=false until account cost controls are verified.
npm run dev
```

Open http://127.0.0.1:3000. The home page lists accessible patients and day-care
visits; patient pages contain readiness, chat, timeline and review history.
`/navigator/[id]` provides a separate family checklist and scheme view; `/review-queue`
is the coordinator's operational worklist. Screen existence does not establish complete clinical workflows.

Each request connects using the locally configured key-pair identity or PAT file with primary
`SAARTHI_APP` and secondary roles disabled. The role is pinned; `SNOWFLAKE_ROLE`
cannot override it. Account migrations require `SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT`
to match `SNOWFLAKE_ACCOUNT`; omission retains the default `OHCXVXM-OS69400` guard (a typo guard, not a security control).
For PAT auth set `SNOWFLAKE_PAT_PATH` and optionally
`SNOWFLAKE_AUTHENTICATOR=PROGRAMMATIC_ACCESS_TOKEN`. Keep token files outside Git.
Restricted sessions that reject role changes are accepted only after a SQL identity
check confirms the app role and no secondary roles. This is a single-operator development
setup using synthetic records, not separate authentication for multiple browser users.
The per-professional authentication work remains committed on COM-11/COM-22 branches.

Keep `.env.local` private. `.env.example` contains the required setting names.
Live access requires `SAARTHI_SNOWFLAKE_ENABLED=true`; missing, false or invalid
values block the connection before any private key is loaded. While disabled,
use `/design-preview/PAT-DC-07` for the recorded project snapshot. Live routes
remain unavailable rather than silently substituting fixture data.
Application sessions set a 120-second statement timeout, a 30-second queue
timeout and the `saarthi_web_prototype` query tag. These are per-statement guards,
not dollar limits or controls for other clients/background services.
See [prototype cost controls](../docs/platform/PROTOTYPE-COST-CONTROLS.md) before enabling access.
Snowflake Cortex is the only model provider. SQL classifies the question before
inference. The `ASK_SAARTHI` entry point is still a thin agent wrapper: the more extensive answer guard is deferred pending fixes.

## Verification

### Current local setup — 1 October 2026

The dashboard now reads through access-checked Snowflake procedures. Keep
the `SAARTHI_APP` role. Set `SAARTHI_SNOWFLAKE_ENABLED=true`
only for planned live testing, then run:

```sh
NODE_USE_SYSTEM_CA=1 npm run dev:recording
```

Both development commands bind to **127.0.0.1 only**. The current local app uses
`SAARTHI_APP`, with secondary roles disabled. Restricted-role reads and denial of
direct patient-table access were verified on OS69400. Fresh patient-bound sessions,
current-user care-team/consent checks, timeouts and the warehouse monitor remain.
Administrator role overrides are rejected. Per-user login is still deferred.

Use `/` and `/patient/PAT-DC-07` for live SQL records. `/design-preview/PAT-DC-07`
remains a recorded fixture. `/review-queue` now reads scoped Snowflake readiness
and task records and links to live patient pages; it has no fixture fallback.
The queue shows stored SQL readiness results. The patient page now has a
**Recompute & save readiness** action for one patient; its full UI save/read-back
test is still pending. Refresh queue only reloads stored results. Starting the
frontend does not require another Snowflake deployment or enabled schedules.
Return live access to `false` for offline design work.

Local verification passed: **49 web tests, TypeScript and the production build**.
Live checks and their limits are recorded in [the cost/test log](../docs/platform/PROTOTYPE-COST-CONTROLS.md).

### Local checks

```sh
npm test
npm run typecheck
npm run build
../.venv/bin/python -m pytest -q ..
../.venv/bin/python ../backend/scripts/check_gate.py --all --strict
```

Browser checks need the five synthetic test routes in an isolated checkout outside
this repository. From the original repository root, run
`node web/tests/prepare-fixtures.mjs /absolute/path/to/isolated-checkout`.
The checkout must include `web`, `frontend/contracts` and `frontend/fixtures`.
In its `web` directory, install dependencies and Chromium (`npm ci` and
`npx playwright install chromium`), then run `SAARTHI_SNOWFLAKE_ENABLED=false npm run build`
and `SAARTHI_SNOWFLAKE_ENABLED=false npm run test:e2e`. The normal production build
deliberately excludes those test routes.

Production builds use Next.js's supported Webpack option because Turbopack's CSS
worker could not bind its internal port in the current environment. `npm run dev`
retains Next.js's default development bundler; use `npm run dev -- --webpack` if
the same worker restriction occurs. `npm start` serves an existing production build.

## Account prerequisites and remaining limits

OS69400 received targeted procedure updates, not another full data deployment.
The new definitions are in `backend/sql/procedures/web_reads.sql`,
`web_workflows.sql`, `web_evidence.sql` and `extract_one_document.sql`.
`backend/scripts/deploy-web-integration.mjs` prints the five-procedure read/task
patch and requires its exact plan hash to apply. It does not install the separate
evidence/extraction/Search updates. Those were installed separately with approval.
The new files are not yet wired into `setup.sql`; clean-account deployment of the
complete patch has not been rehearsed. Do not assume the old setup alone installs it.

Scheme checks use SQL coverage/state proxies, not verified scheme authorisation.
Navigator timing/checklist mapping and language regression checks remain incomplete.
Answer history stores source/access pointers, not a saved transcript. Practitioner
packets are prepared, not delivered. Their procedures and UI are implemented, but
save/reload runtime verification remains. Synthetic tests are not clinical validation.

The Review Queue reads patient, visit, readiness and task records through three
fixed-view procedure calls on one fresh connection. Every read checks
the active current-user practitioner, treating/coordinator care-team dates, and
consent dates, purpose and facility/organization recipient. No names are used as
join keys. The selected encounter matches the patient page's next-or-latest-visit
selection. The sidebar and row links open live `/patient/[id]` routes.

Readiness is the **stored SQL result**, not a new all-patient evaluation on every
page view. Each result exposes `known_as_of`; Refresh queue re-reads the database.
It does not resume tasks, refresh dynamic tables, invoke AI or regenerate results.
After underlying clinical data changes, readiness must be recomputed before the
stored queue changes. There is no polling or fixture fallback.

Actual task owner, state, decision, task ID and creation time are read separately
from clinical outcomes. No task is shown as “No task created,” not an invented
unassigned task. Open tasks for other encounters remain visible separately.
Request-document/escalation filing remains on the patient page. Review history
now includes acknowledge, reassign and resolve controls, a required reason,
retry protection and a record of each saved action. The approved Gopal Das test
task was acknowledged, reassigned to the same eligible owner and resolved; retries
did not duplicate actions and all 12 clinical results stayed unchanged. Only one
eligible practitioner existed, so a handoff to a different person is still untested.
The new controls still need their complete browser-level save/reload test.

One existing one-page project PDF passed parsing, two independent model-family
extractions, patient Search, exact source-text retrieval and a cross-patient denial.
Both Search services were then suspended to limit spend. The reference corpus is
empty; real reference retrieval is unverified. The test did not prove a new PDF
changing a clinical rule result or a complete validated cited answer on screen.
Hosting, per-user access, the full answer guard and final permission/session tests
remain open. Judge Console is not part of this frontend scope.

See `../docs/history/WORKSPACE-RECONCILIATION-2026-09-30.md` and
`../docs/history/WORKSPACE-BASELINE-2026-09-30.md` for preservation decisions and verification.
