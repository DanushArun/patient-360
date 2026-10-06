# Saarthi Copilot live capability check — 6 October 2026

Account `PVYRHHT-XG46956` (locator `WH11571`), AWS_AP_NORTHEAST_1; session user `DAKSHA`.
Synthetic data only. These are engineering checks, not clinical validation.

## Verified on the live account

- `claude-opus-5-5` responds through Snowflake `AI_COMPLETE` and is pinned on
  `SAARTHI.OPERATIONAL.SAARTHI_AGENT`. The live agent has 8 generic procedure tools and 4
  staged skills. Tool inputs omit patient, encounter, and facility selectors.
- Prompt store `copilot@2026-10-06.1` contains response and orchestration prompts. Source
  configuration checks the prompt text against the agent YAML and SHA-256 manifest; the live
  agent comparison receipt is `xg46956-agent-live-verification.json`.
- Full synthetic document path ran for 16 PDFs: Snowflake `AI_PARSE_DOCUMENT`, two-family
  extraction (`llama3.3-70b` and `claude-haiku-4-5`), assertion verification, reconciliation,
  and readiness materialization. Current aggregate: 81 verified assertions and 9 unverified
  findings (6 from these document reads plus 3 pre-existing seed findings). Reconciliation
  added 0 support links; it did not force a match.
- Chrome at `http://127.0.0.1:3000/patient/PAT-DC-05#documents` refreshed to the new record
  snapshot: the lab report is Present, 6 assertions, all 6 verified, 0 conflicting. Readiness
  displays the SQL-computed ANC 1160 versus threshold 1500 check.
- One uncanned Class B question completed through the real Snowflake model, SQL validator,
  and answer-history path. It returned 4 cited claims (treatment-plan row, WBC, platelets,
  and `CLIN-ANC-001` v1) with status `partial`; one model candidate was omitted by validation.
  The dated answer and citations are visible in Chrome. An unsafe visit-relevance formulation
  was classified Class A and refused with the named practitioner referral.
- Live dashboard evidence of citation rendering and record counts is in the browser state;
  SQL model and pipeline query IDs are in `evidence/coco/verification-query-ids.md` and
  `evidence/qa/xg46956-*.json`.
- Copilot composer CSS now keeps the prompt, scope selector, and Send control inside the 400px
  panel. A long cited answer no longer creates horizontal overflow. Shift+Enter produced a
  second line; Enter-to-send behavior remains wired to the existing guarded submit handler.

## Live failures and remaining gaps

- The scheduled task graph reports `started`; parsing, extraction, and reconciliation ran
  successfully. Five readiness runs failed because task sessions used the account default
  `America/Los_Angeles`, while procedure code interprets `TIMESTAMP_NTZ` snapshots as UTC.
  All seven task sessions are now pinned to UTC and remain started. The first scheduled
  post-fix readiness run completed `SUCCEEDED` in 4m03s; its notification child also succeeded.
  A dashboard refresh then showed a source evidence timestamp of 05:51 UTC, but the overall
  readiness headline remained at 05:24 UTC. A manual full-cohort refresh hit the client
  session's 120-second timeout. Therefore recurring processing resumed, but complete
  whole-cohort snapshot freshness still needs verification.
- No Snowflake resource monitor exists on this account. Scheduled AI tasks are active. The
  warehouse's auto-suspend and task completion after the cutoff fix must be verified before
  calling the recurring pipeline healthy.
- The reference corpus has 628 chunks and an active Cortex Search service, and the agent has a
  separate reference-search tool. However, the dashboard reference selector is disabled and
  `/api/ask` rejects reference scope. Do not claim cited reference Q&A is available in Chrome.
- The Day Care cohort copilot initially failed because `withReadSession` discarded binds used
  by `CLASSIFY_QUESTION(?)`. Its callback now forwards binds. Chrome verified
  “List the blocked patients” returns 5 patients, SQL-provided reasons, patient links, and
  totals of 5 blocked, 1 conflict, 3 waiting, and 3 ready. Bind propagation and the Class A
  refusal clock each have regression coverage. This is a guarded cohort query; a single
  global natural-language supervisor over every dashboard page and action is not yet
  implemented or tested. Existing bounded review-task actions remain subject to their SQL
  role, version, and idempotency checks.
- `openai-gpt-6.1-sol` is not recognized by this Snowflake account. Opus 5.5 is the tested
  provider. A separate OpenAI credential/provider deployment is not evidenced here.
- The local `.env.local` has a configured `SAARTHI_RELEASE_REVISION` and the dashboard
  reloaded after Next reported the environment update. A fresh `/api/health` response could
  not be confirmed from this shell/browser session; patient workspace routes and the copilot
  did work.

## Local verification

- Web: `npm test` — 340 passed.
- Python: copilot configuration and task timezone contracts — 15 passed. Earlier focused
  copilot, answer-gateway, document SQL and gate snapshot suites — 61 passed.
- Web TypeScript: `npm run typecheck` — passed.
- Source prompt verifier: `PYTHONPATH=. ./venv/bin/python
  backend/scripts/verify_copilot_configuration.py` — passed.
- Live manual full-cohort readiness refresh: timed out at the connector's 120-second limit;
  do not report this as a pass.
