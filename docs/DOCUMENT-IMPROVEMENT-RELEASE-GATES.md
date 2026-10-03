# Document improvement: remaining release gates

3 October 2026. Local candidate work only. This file does not authorise deployment,
queries, paid calls, background services or hosting. Existing architecture and
clinical rules remain authoritative.

## What is ready for review

| Area | Local work | Still required |
| --- | --- | --- |
| ANC | Confirmed comment/expression mismatch and input safety flags | Source-field semantics, units/specimen matching, qualified clinical approval; no formula change yet |
| Document type/quality | Explicit-heading routing, unknown fallback, no filename quality claims; supplied parse-output evaluator | Live parser exports, table/reading-order evaluation beyond four simple fixtures, original-image review |
| Verification | Batch reader no longer receives first answer; both paths have exact quotes, typed agreement, null withheld values and bounded output | SQL compilation, malformed/failure tests, one shared envelope, persistent specimen links, controlled historical migration |
| Patient evidence | Search adds verified assertion IDs/spans; validator rechecks access/cutoff/trust and returns canonical source positions | Test real Search → answer orchestration → validator → clickable source; no claim that instructions alone enforce this |
| Reference evidence | Existing separate corpus preserved | Exact clause identity/span validation remains open; patient assertions must not stand in for reference clauses |
| LangExtract | Real library with fake responses; opt-in Snowflake-only transport, fake HTTP tests, A/B/C saved-output scorer | Connect real server authorisation/token provider, bounded live calls, held-out accuracy and actual usage comparison |
| Performance | Earlier frontend fixture baseline preserved; local parser/adapter timings separate | New production/browser run, live data/AI timing, cold/warm samples, hosted field metrics later |
| Deployment | Six existing SQL files changed locally; no schema migration | Review/compile incrementally on approved account, user E2E, then separately approved hosting |

## SQL patch review order — do not run full setup

1. `backend/sql/tasks/parse_documents.sql`
2. `backend/sql/tasks/extract_assertions.sql`
3. `backend/sql/procedures/extract_one_document.sql`
4. `backend/sql/procedures/tools/03_search_patient_documents.sql`
5. `backend/sql/procedures/validate_answer.sql`
6. `backend/sql/agent/saarthi_agent.sql`

Before installation, capture current deployed definitions and grants with the
account owner's approval. Local Git HEAD is not proof of the deployed rollback
version. Recheck grants after any CREATE OR REPLACE. Keep tasks suspended; the
batch ten-page limit is not a lifetime spend limit, and zero-finding pages may
be picked again by a later run. Do not start schedules or full ingestion during
the one-page evaluation. Do not replace source documents or delete assertions
to make a test pass.

Compile first; stop at the first error. Offline string/source tests cannot prove
Snowflake scripting compatibility. Restore captured definitions if an approved
live regression fails, rather than changing clinical data or weakening guards.

## Minimum live acceptance tests after separate approval

- Current patient/care-team/consent checks succeed; revoked consent and another
  patient fail before returning evidence or making a model request.
- One selected synthetic page: two independent model families, exact quotes,
  verbatim units, typed pending/negative states, no silent value conversion.
- Repeated concepts remain separate; repeated identical passages are rejected
  until source context can be resolved reliably.
- Parser malformed/empty/duplicate pages, model timeout/truncation and missing
  second read do not yield verified assertions.
- Search chunk IDs are retrieval context; only real verified assertion IDs may
  support patient facts. Future, inactive, wrong-patient and invalid-span evidence
  is refused. Altered citation coordinates are replaced with stored coordinates.
- Open the cited source and confirm exact characters, correct patient, document,
  page, cutoff and version. Reference questions stay in the reference corpus.
- Trace the real orchestration path through validation; merely updating the
  validator procedure or prompt is not proof every answer is validated.

## Bounded test budget — approved 3 October 2026

For a compatibility comparison on one existing synthetic page: at most **four
REST model calls**, two readers without LangExtract and two with it, each capped
at 1,800 output tokens. No retries, Search services, reparsing, batch jobs or
scheduled work. Actual input prompts must be inspected before dispatch.

Using the 2 October 2026 published rates and assuming 2,000 input tokens per call:
two Llama 3.3 70B calls plus two Claude Haiku 4.5 calls use approximately **0.013736
AI credits** with maximum output, or **$0.027472** at $2 per AI credit. Regional
AI credit pricing at $2.20 gives approximately $0.03022. This is an illustrative
inference estimate, not a measured bill or hard account-wide cap. Input length,
account terms and any warehouse-based access checks affect the total.

Approved budget: **$1 total for this bounded test**, confirmed by the user.
This does not authorise deployment, role/grant changes or background services.
No model calls have been made.
Request limits alone do not enforce a dollar cap. Before execution, confirm
account/routing/pricing and the access-check path; refuse the run if the preflight
estimate cannot fit the approved budget. Record returned usage per request and
stop when usage is unavailable or the remaining budget is uncertain. Do not
query billing repeatedly; account-usage records may lag.

Sources checked: [Snowflake consumption table](https://www.snowflake.com/legal/creditconsumptiontable/),
[AI credit pricing](https://docs.snowflake.com/en/user-guide/snowflake-cortex/pricing).

### Approved preflight result — 3 October 2026

The metadata-only preflight attempted key-pair authentication using the existing
local key. The first connection failed with certificate-chain error `407002`.
Using Node's system CA store (the previously documented local configuration)
then reached a different failure: the presented certificate lacked OCSP
AuthorityInfoAccess, and the existing fail-closed driver refused the connection.
The SDK retried internally; the process was stopped. A 45-second whole-process
deadline was added afterward to bound any future metadata preflight.

**No SQL statement executed, no patient/source page was read, no warehouse was
selected or resumed, and zero inference calls were sent.** No TLS/OCSP protection
was disabled. Account default role, routing and warehouse safeguards remain
unverified; the approved $1 trial has not run. Next step is a trusted connection
that passes the existing certificate checks (for example, an approved network
without HTTPS inspection), not an inference retry or a full redeployment.

### User-requested retry — connection succeeds, role gate blocks inference

The subsequent approved retry passed TLS/OCSP and confirmed account locator
`JR18576`, user `SITAR`, routing `ANY_REGION`. The warehouse was already
`SUSPENDED`, `X-Small`, auto-suspend 60 seconds, with monitor
`SAARTHI_PROTOTYPE_LIMIT`: quota 2.00 credits, reported use 1.21, immediate
suspension at 90%. Monitor reporting may lag and excludes inference.

`SITAR`'s default role is `ACCOUNTADMIN`. The Cortex REST default-role check
therefore stopped the test before source retrieval or inference. No role or
grant was changed. Switching the user's default role affects other default-role
sessions and requires explicit approval; it is not included in the $1 budget
approval. No warehouse was selected/resumed and zero model calls were made.

Query IDs (metadata/session statements only):
`01c7791c-0003-f2ea-0001-fcae000eb93e`,
`01c7791c-0003-f2ea-0001-fcae000eb942`,
`01c7791c-0003-f2ea-0001-fcae000eb946`,
`01c7791c-0003-f2ea-0001-fcae000eb94a`,
`01c7791c-0003-f2ea-0001-fcae000eb94e`,
`01c7791c-0003-f2ea-0001-fcae000eb956`,
`01c7791c-0003-f2ea-0001-fcae000eb95a`.

### Default-role change approved; connection failed before applying it

The user subsequently approved changing `SITAR`'s default role to `SAARTHI_APP`,
without changing existing grants. The explicit `--approved-set-app-default`
preflight mode first verifies account identity and that the role is already
usable, applies only that ALTER USER, then reads back the default role.

The attempted run did **not** reach any SQL: the certificate again lacked OCSP
AuthorityInfoAccess. The 45-second deadline stopped SDK connection retries.
Consequently the approved role change has **not been applied**, and the last
verified default remains `ACCOUNTADMIN`. Zero inference calls and no warehouse
resume occurred. No certificate validation settings were weakened. Approval
remains recorded; do not claim success or restart paid work until a secure
connection permits the role change and read-back verification.

### Follow-up diagnosis — HTTPS inspection confirmed

Another user-requested retry stopped at the same authentication error before
SQL. A separate credential-free TLS handshake to the same Snowflake hostname,
with normal hostname and certificate validation enabled, showed an enterprise
Netskope-issued certificate. The OS trusted that chain, but its
AuthorityInfoAccess extension was absent. This explains the driver's fail-closed
OCSP rejection; changing Wi-Fi alone may leave endpoint inspection active.

No protection was disabled and no corporate networking setting was changed.
The next prerequisite is an organisation-approved Snowflake TLS-inspection
exception or another approved execution environment with a valid direct
certificate chain. No inference calls or role changes ran in this retry.

The later user-requested attempt after creating a public key encountered the
same certificate/OCSP failure before authentication. The new key's registration
and matching private key therefore remain unverified. That attempt also made
no SQL statements, model calls or warehouse changes. Work is being handed off
on `langextract_use`; the live runner is still incomplete, not ready to invoke
simply by enabling the frontend flag.

## Clinical and hosting approvals are not software test results

A qualified reviewer must resolve whether each source's neutrophil percentage
already includes bands, what missing components mean, required units and matching
keys, and when a reported ANC supersedes a derived one. Do not amend the formula
based on an LLM interpretation or treat an unreported input as zero.

Hosting stays deferred until the user has tested the complete workflow. Confirm
hosting destination and budget, per-user authentication, server-side credentials,
least-privilege roles and TLS. Never publicly deploy administrator recording mode.
