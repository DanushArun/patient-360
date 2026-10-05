# SAARTHI copilot deployment and funded-account acceptance

Updated 5 October 2026. Danush owns final copilot tuning on the teammate account.
This repository supplies the gateway, SQL tools, MCP configuration and verification runners.
Source checks are separate from account execution. No portal submission is authorized.

## Account and session boundary

Configure these environment variables explicitly for the destination account:
`SNOWFLAKE_ACCOUNT`, `SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT`, `SNOWFLAKE_USER`,
`SNOWFLAKE_PRIVATE_KEY_PATH`, and `SNOWFLAKE_WAREHOUSE=SAARTHI_AI_WH`.
The first two must match. Shell environment overrides the local web environment file.
Use a restricted application identity for hosting; never upload an ACCOUNTADMIN user's key.
Keep TLS and OCSP validation enabled. The current machine's corporate proxy prevents strict
SDK verification; that is a connectivity failure, not permission to bypass validation.

The user selects the patient. `withPatientSession` creates a fresh connection, disables
secondary roles, binds the patient, calls ASK, records the answer, then releases/destroys
that connection. Patient identifiers never enter agent tool schemas.

## Local source verification

Run from the repository root:

```bash
.venv/bin/python -m pip install -r requirements.txt -r backend/verification/requirements.txt
.venv/bin/python -m backend.scripts.build_deploy_bundle --check
.venv/bin/python -m backend.scripts.verify_copilot_configuration
.venv/bin/python -m pytest -q
```

The configuration receipt checks all eight tool resources, their actual SQL signatures,
required parameters, scope-selector exclusion, closed schemas, pinned orchestration and
four stage-mounted skills. It is explicitly an offline receipt.

## Clean account installation

Only use an approved empty/disposable destination account. The installer refuses an
existing SAARTHI database. Do not use setup.sql as a migration on the existing account:
its CORE table rebuilds are destructive.

```bash
.venv/bin/python -m backend.scripts.install_clean_account
```

The installer connects without requiring a pre-existing warehouse, follows setup.sql's
canonical dependency order, selects the warehouse once created, stages the four validated
facility CSV files before COPY, and replaces the legacy task user with the installing user.
That user becomes the synthetic practitioner in load_synthetic.sql. Each executed SQL
statement records its real query ID. Four CSV SHA-256 hashes are retained in the report.
Tasks must remain suspended until the operator deliberately starts the paid pipeline.

The canonical path includes policies, patient bindings, classifiers, validator, eight tools,
web procedures, ontology/rules, dynamic tables, two Search services, semantic view/VQRs,
skill upload, pinned agent, gateway helpers, ASK, MCP, and finally the API permission allowlist.
The generated patch bundle is for an existing database and intentionally omits some bootstrap
objects. Do not mistake it for a clean installation.

## Documents and ingestion

The CSV bootstrap does not prove PDF/FHIR ingestion. Generated synthetic PDFs live under
`data/generated/pdf/`; their patient IDs and SYNTHETIC labels must match the manifest.
`backend.scripts.prepare_synthetic_documents` can produce bounded DOCUMENT/DOC_PAGE SQL
from that manifest, but that digital-text path is not AI_PARSE_DOCUMENT proof.
For the full ingestion gate, use run_golden_loop with a new hash-checked generated PDF:
its PUT must return UPLOADED, two-family extraction must verify a new assertion, and the
configured encounter/rule version/outcome must cite that assertion.

Reference PDFs live in `data/reference/`. Keep their stage and Search service physically
separate from patient documents. Per-file origin/licence/version disclosures remain tracked
in docs/DATASET-LICENCES.md; do not describe unverified publication metadata as verified.

## Answer boundary acceptance

ASK is the only user-facing generation entry point. It checks access and classification
before inference. Clinical questions return a named practitioner refusal packet.
Native model output is a candidate, not a decision. Typed candidates require exactly one
source per claim. Legacy prose contributes explicit source identifiers only; its narrative
never becomes a medical fact. Generated conclusions cannot survive as lab answers.

The SQL validator checks scope, cutoff, source existence, value/polarity and extraction
verification. Structured text is generated from SQL. Document answers return the exact
verified passage and canonical database value after validation. AI_FILTER errors strip the
claim. Within-tolerance candidate numbers are never displayed instead of database numbers.
Separate claims are required for separate records. Contradictions are reconciled in SQL.

Run supported, contradicted, missing, conflicting, malformed and dependency-error cases.
Check all source clocks and open each exact span from the actual deployed UI.
Final model availability and these latest SQL changes need destination-account verification.
The current account's live bounded lab fallback is not proof of native AI execution.

## MCP boundary acceptance

Apply governance/04_pat_provisioning.sql only after the agent/MCP objects exist and after
reviewing the destination permissions. It creates no user, token or network policy.
The MCP role receives server + ASK access; raw agent and blanket procedure access are revoked.
The operator assigns the selected identity, approved network CIDRs and a role-restricted PAT.

Set `SAARTHI_MCP_HOST` explicitly to the destination's hyphenated Snowflake hostname and
supply `MCP_PAT` from the secret store. Never put a token in source, logs or a recorded demo.

```bash
.venv/bin/python -m backend.scripts.mcp_client health
.venv/bin/python -m backend.scripts.mcp_client list-tools
.venv/bin/python -m backend.scripts.mcp_client call "What platelet value is recorded?"
```

Discovery must expose exactly ask_saarthi with QUESTION only. SSE progress messages must not
be mistaken for the final response. No raw Search, SQL, Analyst or agent endpoint is exposed.
An MCP transport session does not establish CURRENT_SESSION() patient binding. An unbound
call must deny. Do not enable external patient Q&A until human binding continuity is proved;
use the application's already-bound SQL connection for the final copilot test meanwhile.

## Verification order and receipts

1. Native availability, registered skills and seven VQR runtime traces:
   `python -m backend.scripts.verify_native_execution --incremental`.
   PARTIAL is expected until traces are correlated and skill/VQR invocation is adjudicated.
2. Authorized, foreign-source, subsequent revocation and ten-connection scope probes:
   `python -m backend.scripts.verify_security_isolation --allow-consent-revocation`.
   The synthetic consent probe restores original values in finally. This does not prove
   cancellation of an already running query; that needs a separate concurrency trace.
3. Frozen evaluation: run_evaluation_benchmark requires --dev, --heldout, --gold and --freeze.
   Patient/layout/document hashes must be disjoint. Gold requires explicit expected_claims,
   including empty lists for no-claim cases. Old data/eval files fail the independent gate.
   Rescore the exact captured --results file after claim-specific document adjudication.
4. Golden loop: run_golden_loop requires --config with document_path, document_sha256,
   patient_id, encounter_id, rule_id, expected_rule_version, expected_outcome, question and
   issue_id. Record immutable history and browser timeout/retry recovery separately.
5. Hosted release: configure restricted server-side credentials, then run release_preflight
   with --frontend-url and --backend-url. A recorded preview is not a live-backend pass.
6. Operator/economics: simulate_workflow_economics accepts --observed-csv and --usage-json.
   Measure identical cases with counterbalanced order. Supply actual consumption receipts,
   credit price, wage and currency; do not relabel seeded simulation as observed benefit.
7. Freeze the release revision, refresh deck/script claims, and record the video last.

All scripts support --help except the deliberately minimal clean-account installer.
Keep failures and fixes in evidence/qa. Completion is gated on live receipts, not source counts.

## Current known integration gaps

- Reference quotation support is implemented in source and requires deployment plus corpus loading:
  `python -m backend.scripts.load_reference_documents --load --output reference-load.json`.
  The default omits --load and checks local bytes only. Parser-warning pages are quarantined.
  Publisher/version metadata comes from the checked local catalog; five publisher origins are byte-matched; FDA/NHA origin, currency and
  effective dates remain unverified. Reference quotations cannot establish patient findings.
- Canonical ROW and versioned RULE citation adapters are implemented and live probes passed.
  Main app-role validator strips foreign and unknown-version RULE pointers and retains provenance.
  Full tool/finalizer/receipt source parity and hosted execution still require verification.
- MCP patient-binding continuity, concurrent writes, in-flight withdrawal, independent holdout,
  observed workflow economics and the connected new-document golden loop remain open.
  Standalone history immutability and fixture browser-chaos checks have actual passing receipts.

## Documentation checked 5 October 2026

- Agent skills: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-skills
- MCP generic procedures/streaming: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp
- Trial AI activation: https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-desktop/index
  Adding a credit card can enable trial AI without ending the trial. Danush explicitly chose
  to keep billing unchanged here and use the teammate account for final tuning.


## Latest coordinated deployment prerequisites

Local regression: 684 Python passed, 14 live skips, 36 subtests; 291 web passed;
typecheck/build passed. This is source validation, not hosted-account verification.
Install the updated normalization dynamic table before its readers (bundle step 01).
It now exposes normalized `unit`. Deploy VALIDATE_ANSWER with `access_scope`, then
ANSWER_GATEWAY_CONTEXT_PACK, ANSWER_GATEWAY_CONTEXT_SECTION, ANSWER_GATEWAY_CONTEXT,
ANSWER_GATEWAY_INFER and ASK_SAARTHI, before deploying the new frontend. Never mix
an old validator lacking the fingerprint with the new web boundary; it fails closed.
After binding PAT-DC-04 as SAARTHI_APP with secondary roles disabled, call
VALIDATE_ANSWER(ARRAY_CONSTRUCT(),NULL). Require a 64-character hexadecimal access_scope,
empty claims and a populated SQL clock. Verify stable scope on another call, and a
changed/denied scope during a separately controlled consent-category change. Restore
consent exactly even on failure.
Run the reversible category probe:
`python -m backend.scripts.verify_consent_categories --allow-consent-narrowing`
The security runner exits 2/PARTIAL when in-flight cancellation is not proven; do not
turn that into PASS or omit it from the release checklist.

Current-account compilation receipts: private inference adapter
01c78415-0004-0d3e-0001-fe5a00171086; ownership-only grants
01c78415-0004-0d3e-0001-fe5a0017108e; normalization SELECT EXPLAIN
01c78418-0004-0e08-0001-fe5a00170c4e. These are not inference or refresh runtime proof.
The approved 3-credit monitor cap blocks further warehouse execution here. Billing and
allowance remain unchanged. Use the teammate account for required execution.

## Bounded context acceptance

Run the updated ten-session security harness: each connection requires an authorized,
nonempty patient-search positive control before an adversarial foreign-patient search.
Foreign document/event/patient identifiers must never appear in either response.
Confirm all context sections use the same SQL-derived known_as_of. Reference and patient
hits remain separate. Unknown/unavailable sections are explicit; dependency error details
are redacted. Final answers still pass deterministic validation and post-response scope checks.
Context has nine sequential providers: measure its added latency in the warm cohort; no p95
claim is supported yet. Metadata compilation does not prove nested calls or native execution.
See evidence/qa/COPILOT-CONTEXT-2026-10-05.md for compilation and failure/fix receipts.

## Hosted health acceptance

Set SAARTHI_RELEASE_REVISION on the server to the exact frozen commit (40 hexadecimal
characters) or source manifest hash (64 hexadecimal characters). Use /api/health as the
backend health URL. It runs an existing restricted SQL workspace read, requires a nonempty
authorized result and returns its actual query ID; it never returns patient content.
A missing revision, dependency failure or missing receipt returns 503/no-store.

Release preflight now requires --release-revision matching that value:
`python -m backend.scripts.release_preflight --frontend-url https://YOUR_HOST/ --backend-url https://YOUR_HOST/api/health --release-revision YOUR_FROZEN_HASH`
The shell wrapper requires SAARTHI_RELEASE_REVISION alongside its two health URL variables.
An HTTP 200 HTML preview cannot pass the backend check. A healthy endpoint alone does not
prove the full judge workflow or cross-session isolation; complete those gates separately.
