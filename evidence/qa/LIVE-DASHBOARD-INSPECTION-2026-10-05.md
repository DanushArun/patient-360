# Live dashboard inspection — 5 October 2026

Inspected commit `16befcb4a0bc0d3592526e988f955d864fb76295`, using the real
local dashboard in Chrome and strict Snowflake SDK connections. User confirmed
`KGTPGHJ-YJ28449` / `NY64016` as the intended account. Synthetic records only.

## Current verdict

The live dashboard is unavailable. Authentication works; warehouse execution is
blocked. Passing source checks do not establish a usable submission.

- Local `GET /api/patient/PAT-DC-04` returned HTTP 502 with `service_unavailable`.
- Chrome at `http://127.0.0.1:3000/` showed patient/visit counts unavailable,
  patient list unavailable and disabled patient selection.
- `GET_WEB_WORKSPACE`, `BIND_PATIENT`, `VALIDATE_ANSWER` and binding release
  each failed with Snowflake `090073`: the warehouse cannot resume because
  `SAARTHI_PROTOTYPE_LIMIT` exceeded its quota. Binding creation did not succeed.
- Metadata reports quota **3.00**, used **2.74**, remaining **0.26**, and
  **90% SUSPEND_IMMEDIATE**, `FREQUENCY=NEVER`. The effective suspension
  threshold is **2.70**, explaining suspension before the nominal 3-credit total.
- ACCOUNTADMIN metadata returned **zero Cortex Search services** in SAARTHI
  and **three tasks**, all suspended. These are current-account observations;
  services/tasks reported on earlier accounts must not be transferred here.
- Deployed `VALIDATE_ANSWER(VARIANT,VARCHAR)` lacks `access_scope`. The current
  web boundary requires it and will fail closed even after compute is restored.
  Coordinated source deployment is required before calling the dashboard ready.
- The public host root showed the same unavailable-state screen;
  `/api/health` returned HTTP 404. The recorded preview returned HTTP 200,
  with source actions disabled. It is not live backend evidence.

## Actual metadata receipts

| Observation | Query ID | Role |
|---|---|---|
| Strict authentication/session identity; secondary roles empty | `01c78577-0004-0e08-0001-fe5a0017387a` | SAARTHI_APP |
| Warehouse suspended | `01c78578-0004-0d3e-0001-fe5a00171d0e` | SAARTHI_APP |
| Warehouse/attached monitor | `01c7857c-0004-0d3e-0001-fe5a00171e12` | ACCOUNTADMIN, metadata only |
| No Search services | `01c7857c-0004-0e08-0001-fe5a0017398e` | ACCOUNTADMIN, metadata only |
| Three suspended tasks | `01c7857c-0004-0e08-0001-fe5a00173992` | ACCOUNTADMIN, metadata only |
| Quota, usage and immediate-suspend trigger | `01c7857c-0004-0d3e-0001-fe5a00171e1a` | ACCOUNTADMIN, metadata only |
| Existing procedure signatures | `01c7857c-0004-0e08-0001-fe5a00173996` | ACCOUNTADMIN, metadata only |
| Agent object exists (not invocation proof) | `01c7857c-0004-0e08-0001-fe5a0017399a` | ACCOUNTADMIN, metadata only |
| Validator DDL feature inspection | `01c7857c-0004-0d3e-0001-fe5a00171e1e` | ACCOUNTADMIN, metadata only |

The strict Node probe used the repository driver configuration:
`disableOCSPChecks=false`, `ocspFailOpen=false`, with `NODE_USE_SYSTEM_CA=1`.
It succeeded outside the sandbox. The earlier proxy/TLS failure is not reproduced
by this fresh connection. A sandbox Python attempt failed before authentication;
the approved outside-sandbox retry authenticated and reached metadata queries.

The preflight correctly failed for absent Search. No patient content was read
as ACCOUNTADMIN. SQL runtime attempts used SAARTHI_APP with secondary roles NONE.
No quota, grants, tasks, Search services, patient data or portal state was changed.

## Fresh source verification

| Check | Observed result |
|---|---|
| `./venv/bin/python -m pytest -q` | 684 passed, 14 skipped, 36 subtests passed |
| `cd web && npm test` | 291 passed, zero failed |
| `npm run typecheck` | Exit 0 |
| `SAARTHI_SNOWFLAKE_ENABLED=false npm run build` | Exit 0 |
| `npm run test:e2e` | 41/41 passed; isolated synthetic APIs, not live Snowflake |
| Deploy bundle drift | Current, 11 files |
| Deployment manifest | 71 active steps resolve |
| Copilot source configuration | PASS, offline only |

The first fixture browser run could not bind port 3100 inside the sandbox.
The approved outside-sandbox rerun passed all 41 tests. That environment failure
is retained here; it is not counted as an application-test failure.

## Recovery acceptance

1. Obtain authorization for additional compute allowance; keep the existing
   immediate-suspend trigger and bounded warehouse configuration.
2. Deploy the compatible normalization/validator/gateway/web procedures in
   dependency order, preserving grants and patient data. Verify `access_scope`
   at the actual restricted endpoint.
3. Reload Chrome and demonstrate a nonempty authorized census and real patient
   records. Open source evidence, ask a record question, verify clinical refusal,
   and save/reopen a reviewed action through the actual database.
4. Install and populate missing patient/reference Search separately, with
   explicit serverless cost authorization; warehouse quota does not cap Search.
   Verify native-agent availability and complete final evaluation/golden-loop
   gates before describing all system paths as working.

The proposed bounded compute recovery is `CREDIT_QUOTA=4` (3 → 4 total credits),
retaining the 90% trigger. It is prepared, not applied, pending user authorization.
