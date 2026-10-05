# Release checkpoint — 4 October 2026, approximately 23:23 IST

Account: KGTPGHJ-YJ28449 / NY64016. All system records used are synthetic.
Working tree changes are uncommitted on base 6db4347afd6be9bc4062aab5797439018ab58389.

## Regression results

- Python: 463 passed, 14 live-dependent skips, 36 subtests passed.
- Web: 273 passed, no skips.
- Typecheck and Next.js production build: passed.
- Browser E2E: 40 passed in the isolated fixture application, 22.2 seconds.
  These tests cover responsive workflows, access withdrawal, uncertain save receipts
  and retry identity. They do not prove Snowflake security or a hosted release.
- Generated SQL bundle: rebuilt, 11 files. Always run --check after further SQL edits.

## Actual gateway results

| Probe | Query ID | Observed result |
|---|---|---|
| Clinical question through ASK | 01c78254-0004-0d3e-0001-fe5a0016b416 | CLASS_A, refused, SQL clock present; 3.9s |
| Direct agent dependency | 01c78257-0004-0d3e-0001-fe5a0016b47e | Code 399504, Access denied for trial accounts |
| Bounded SQL fallback | 01c7825f-0004-0d3e-0001-fe5a0016b54e | Cited PAT-DC-04 platelet record, clocks; 6.7s |
| ASK after recorded-question routing fix | 01c7826c-0004-0d3e-0001-fe5a0016b6d6 | CLASS_B cited record through SQL fallback; 8.9s |

Single samples are not p95. The fallback supports explicit PLT, ANC and WBC record
queries only. It is partial and states that the agent dependency was unavailable.
It never accepts a narrative conclusion as a medical fact. ANC derivation remains
subject to the validator's derived-evidence restrictions.

Failure/fix records: unbound v_ids in nested CALL fixed with a payload variable;
concept_id display-name assumption fixed to concept_name; recorded lab questions
previously reached unavailable AI_CLASSIFY, now deterministically route as record state.
Classifier dependency errors default to CLASS_A.

## Client connectivity

Strict HTTPS via macOS works. Python certifi lacks the installed corporate proxy CA.
Existing public macOS certificates were exported to a temporary bundle. A preliminary
Node probe then authenticated, query 01c7826d-0004-0d3e-0001-fe5a0016b77a, confirming
NY64016, SAARTHI_APP and secondary roles NONE. That probe used SDK defaults and is not
production connectivity proof.

Retesting with the production driver configuration (disableOCSPChecks=false,
ocspFailOpen=false) failed: the proxy certificate has no OCSP responder URL / no
AuthorityInfoAccess extension. Production TLS/OCSP settings remain unchanged.
A host outside the intercepting proxy still needs strict-connection verification.

References checked 4 October:
- https://truststore.readthedocs.io/en/stable/index.html
- https://docs.snowflake.com/en/user-guide/ocsp#fail-close
- https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api

## Outstanding gates

The live four-probe security suite, 10 concurrent app sessions, independent frozen
holdout run, native skill invocation, input-to-rule causality, append-only action
receipt, actual consumption attribution, observed operator study, hosted judge access,
finalized deck and recording remain open. The economics JSON is a labeled simulation.

The reviewed least-privilege migration is written in governance/03_grants.sql.
Automatic approval review rejected applying it because the exact allowlist was not
explicitly authorized. Approval is pending; no migration was executed. This matters:
old broad grants expose internal procedures and raw agent invocation to app callers.

Portal submission is explicitly unauthorized and has not been performed.

## 23:58 IST — approved permissions and hosted recorded preview

- User explicitly approved the narrower SAARTHI_APP permission migration.
- Revoked blanket future procedure usage: `01c78287-0004-0d3e-0001-fe5a0016b856`.
- Revoked blanket current procedure usage: `01c78287-0004-0d3e-0001-fe5a0016b85e`.
- Revoked direct agent usage: `01c7828a-0004-0e08-0001-fe5a0016c1b2`.
- Missing RECORD_WEB_ANSWER deployed; its grant is verified as `01c7828c-0004-0e08-0001-fe5a0016c1c2`.
- Missing PREPARE_WEB_PACKET deployed and granted; grant query
  `01c7828d-0004-0e08-0001-fe5a0016c1ea` succeeded.
- Post-migration ASK with secondary roles NONE succeeded in 10 seconds:
  `01c7828c-0004-0d3e-0001-fe5a0016b90e`. This is one sample, not p95.
- Direct app fallback call denied (unknown user-defined function) after revocation:
  `01c78292-0004-0d3e-0001-fe5a0016ba22`. This is helper-denial evidence, not the
  complete multi-user security suite.
- Saved-answer execution stopped at warehouse suspension:
  `01c7828d-0004-0e08-0001-fe5a0016c1f2`. No success receipt claimed.
- Resource monitor SHOW `01c7828e-0004-0d3e-0001-fe5a0016b9da`: quota 2.00 credits,
  used 1.80, remaining 0.20. Suspension threshold reached. Requested approval for quota 3.00.
- Full Python run: 465 passed, 14 skipped, 36 subtests, 3.51 seconds.
- Deployment bundle check passed: 11 files current.
- Product package: 161 allowlisted files, hashes in temporary upload-manifest.json.
  Credentials, research medical reports, node_modules and build output excluded.
- Vercel production recorded preview deployed: https://saarthi-sooty-psi.vercel.app/ .
  Anonymous HTTP GET of /design-preview/PAT-DC-04 returned 200 without cookies or credentials.
  Root recovery link opens the recorded synthetic workspace. No Snowflake credentials uploaded.
  This is a preview release, not a live backend release or complete judge workflow.
- Six-slide official-template deck: docs/submission/SAARTHI-submission-2026-10-04.pptx.
  Package, layout, font policy and first-party import passed. All six renders reviewed.
  Source-template font embedding warnings remain; native PowerPoint rendering not verified.
- Verbatim demo/defense script: docs/submission/FINALS-SCRIPT-2026-10-04.md.
- Portal untouched; video remains last.

## 5 October, 00:18 IST — further live proofs and stronger verification

- Approved credit quota 3 applied, suspension protections retained:
  `01c78295-0004-0d3e-0001-fe5a0016ba52`.
- Answer recording succeeded: `01c78295-0004-0d3e-0001-fe5a0016ba6a`.
- Practitioner packet succeeded: `01c78295-0004-0e08-0001-fe5a0016c266`.
  Packet `submission-packet-20261004`, PRAC-01 / Dr. Test Oncologist /
  NMC-TEST-0001, status prepared, delivered false. Thirteen rule outcomes, four with
  populated evidence arrays; nine with empty arrays. Complete gate evidence coverage is OPEN.
- Actual foreign evidence control: `01c78299-0004-0d3e-0001-fe5a0016bae6`.
  PAT-DC-04 / EVT-DC-04-PLT / 82000 and PAT-DC-07 / EVT-DC-07-PLT / 198000 exist.
  Initial query used invalid NUMERIC_VALUE; corrected to VALUE_NUM. Failure retained in history.
- Scoped validator probe: `01c7829c-0004-0d3e-0001-fe5a0016bb26`.
  Authorized claims 1; foreign claims 0; only generic omission text returned for foreign evidence.
- Consent probe: `01c782a0-0004-0e08-0001-fe5a0016c39e`.
  PASS, active_before 1, active_restored 1, access_withdrawn with non-null known_as_of.
  Mutation was rolled back. Proves subsequent procedure denial, not in-flight cancellation.
- Saved action duplicate retry: `01c782a2-0004-0e08-0001-fe5a0016c3ee`.
  First idempotent_replay false, retry true, same task 8680b106-71d7-45f1-a5b9-bfc49da0cba8.
  Sequential replay only; concurrent write uniqueness is not proven.
- Persistence readback: `01c782a5-0004-0e08-0001-fe5a0016c47a`.
  Answer, packet and action each have exactly one row with their expected IDs and patient scope.
- Metrics regression fixes: typed expected claims checked independently of matching prose;
  unknown citations separated from proven foreign citations; both categories fail scope gate.
- Preflight now requires the two named search services, RUNNING indexing/serving, nonempty
  indexed content, no indexing error and exact canonical source queries. Documentation checked
  5 October: https://docs.snowflake.com/en/sql-reference/sql/desc-cortex-search .
- Golden runner requires absent-before-ingest input and new assertion linked to expected
  rule version/outcome. It reports PARTIAL until immutable history and UI chaos are proved.
- Latest full Python run: 471 passed, 14 skipped, 36 subtests, 3.46 seconds.
- Full gate tracking: docs/submission/RELEASE-GATES-2026-10-05.md, 9/20 verified (45%).

## 5 October, 01:50 IST — copilot portability and trust-boundary continuation

- Completion remains 9/20 (45%). Internal rubric estimate: relevance 25/30,
  technical execution 28/40, completeness 21/30, total 74/100.
- User explicitly keeps billing unchanged here; teammate account owns final AI tuning.
- Live failure/fix: saved answer replay with ANSWER_STATE=error returned error despite its
  stored recorded status. Failure query 01c782c6-0004-0d3e-0001-fe5a0016bd2e.
  Stored-state return deployed; 01c782c7-0004-0e08-0001-fe5a0016c612 returned recorded,
  run_id=submission-proof-20261004, original known_as_of=2026-10-04T11:29:25, 2.5 seconds.
- MCP client/provisioning source repaired to match guarded server, with strict discovery,
  streaming response correlation, explicit target host and no blanket/raw-agent grants.
  No token provisioned and no MCP permission migration executed on the current account.
- Clean installer source stages four validated CSVs before loading, omits absent warehouse
  at initial login, and substitutes the installing operator for hardcoded task execution user.
- Agent schemas closed, domain/write enums enforced, write intent restricted in instructions,
  and GET_CHANGES optional end time aligned with its SQL signature.
- Candidate claims now require one source each; SQL validator independently enforces it.
  Document claims replace generated narrative with exact passage and database value after
  validation; TRY_TO_DOUBLE preserves decimal comparisons. These latest changes are source
  verified only, pending destination-account compilation/evaluation.
- Source configuration receipt: evidence/qa/copilot-source-configuration.json.
  Teammate runbook: docs/submission/TEAMMATE-ACCOUNT-RUNBOOK.md.
- Full Python: 516 passed, 14 skipped, 36 subtests, 4.34 seconds. Connector reports pyarrow
  version mismatch; no warning was suppressed. No new frontend changes in this segment.


## 5 October, 02:14 IST — reference quotation boundary

Implemented reference_clause candidate support only for textual quotations. The internal
SQL resolver checks separate corpus, canonical local SHA-256/path, exact DOC_PAGE containment,
active state and ingestion cutoff. It replaces model text with the source quotation and
returns frozen-contract publisher/title/version metadata. Unknown effective dates remain
not_received; quotations cannot determine patient findings or treatment.

The loader byte-checks all 7 local PDFs/692 pages, quarantines parser-warning pages, and
uses a transactional idempotent insert with existing-document/page conflict checks.
Local parser warnings quarantine 456 pages: 392 Gujarat, all 64 NHA.
231 pages retain readable text; 5 additional pages have no extractable text. These are recorded
in evidence/qa/reference-corpus-byte-check.json; no warning was silently discarded.
Corrected DATASET-LICENCES attribution: the filename labelled AIIMS is actually Government
of Gujarat, First Edition 2013. Official origin byte-match, licence and effective dates
remain unverified. FDA archived URL returned 404; NHA former PDF URL returned HTML.

Full tests: 525 Python passed, 14 skipped, 36 subtests; 275 web passed. Connector pyarrow
compatibility warning remains. Bundle rebuilt, 11 files current; git diff --check passed.
New reference changes are source-only, not a live native/runtime gate. Progress remains
9/20 (45%); estimated readiness 25/30 + 28/40 + 21/30 = 74/100. Portal untouched.

Reference citation UI now labels quotations separately and displays publisher/title/version,
effective-date missingness, jurisdiction and a patient-finding disclaimer. Render regression
passed; latest web count 275, typecheck passed. Original patient source links remain covered.

Production frontend build passed after the reference metadata UI correction.


## Evaluation scorer correction — unexpected claims

Reproduced a correctness bug: a no-claim missing-report gold case accepted a claim
that the final report was negative when the artifact also said not_received.
The scorer now requires every returned factual claim to match frozen expected claims,
including when that list is empty. Regression failed before the fix; targeted metrics
checks passed (21). This closes a source defect, not a live evaluation acceptance gate.
Full Python rerun: 527 passed, 14 skipped, 36 subtests; known pyarrow warning remains.
Overall release remains unfinished at 9/20 verified acceptance gates.

## 5 October, 04:50 IST — bounded rule proof and refreshed package

- Latest full Python run: 571 passed, 14 skipped, 36 subtests. Web 278 passed;
  typecheck and production build passed. Recovery E2E: 8 passed in 5.1 seconds.
  Seven overlap the prior 40 browser checks, giving 41 distinct fixture checks.
- History live proof preserves prior physical receipts, records acknowledge/resolve receipts,
  rejects stale versions and denies direct application-role writes. Dropped-response browser
  recovery reuses its idempotency key after reload. These are component checks, not a newly
  ingested document reaching the deployed UI. See HISTORY-AND-RECOVERY-2026-10-05.md.
- Seven verified query definitions ran as direct SQL with actual child query IDs. Corrected
  conflict query detects PAT-DC-07's pending-table/approved-letter disagreement. Blocker count
  now requires blocker severity. This is not native skill or Analyst-selection proof.
- Independent evaluation v2 freezes 48 development/48 held-out inputs across disjoint patients
  and physical layouts. Eight held-out missing/conflict checks are included. Final extracted
  document gold, independent adjudication and system metrics remain unmeasured.
- Rule citations now recompute the bound encounter and exact version. Main application-role
  validator replaces treatment prose with the canonical SQL record check, retains catalog
  provenance, and strips foreign/unknown-version pointers. Public readiness-to-validator loop
  passed: 01c783b7-0004-0d3e-0001-fe5a0016fa46. See RULE-CITATION-LIVE-2026-10-05.md.
- Incremental verifier now requires new verified assertions on run one before accepting stable
  replay on run two. A first-run no-op cannot pass. Actual fresh extraction still needs AI.
- Metering collector implements lag-aware warehouse/function/agent/search attribution and
  retains raw rows/query IDs. Missing components remain unmeasured; no exact cost is claimed.
- Six-slide official-template deck rebuilt and all six renders inspected. Final package,
  layout, font-policy and reimport checks passed. SHA-256:
  48a86477f874c26f9ad33502751802cf2d7b9b9cffe78b72d9737fa8264e97de.
  Native PowerPoint rendering is unverified; embedded font aliases come from the template.
- Credential-free hosted package refreshed: /private/tmp/saarthi-hosted-release-20261005-0448,
  161 source files. No deployment performed; manifest in hosted-upload-manifest-2026-10-05.json.
- Deployment bundle current: 11 files; copilot source configuration PASS; git diff --check PASS.
  No staging, commit, remote publication or portal submission performed.


## 5 October: consent partition, chronology and offline derivation corrections

Release gates remain 9/20; internal score remains 25/30 + 28/40 + 21/30 = 74/100.
Live category negative/positive/restore proof is recorded in CONSENT-CATEGORIES-LIVE.
GET_CHANGES runtime passed: 01c783d9-0004-0e08-0001-fe5a00170956, 12 events,
all three source clocks, default end cutoff, invalid and reversed cutoff rejection.
GET_PATIENT_FACTS canonical row-pointer compilation passed:
01c783db-0004-0e08-0001-fe5a001709a2. Final runtime probe was blocked:
01c783de-0004-0e08-0001-fe5a001709de, approved resource-monitor quota exhausted.
Do not label compilation as runtime verification or increase credits without approval.

Offline ANC tests reproduced cross-patient and specimen joins, unreadable inputs,
out-of-range differential and foreign direct-result suppression. The source fix binds
patient/specimen/time, rejects invalid or ambiguous differential, waits for both input
clocks and uses source-event-derived IDs. Eight behavior tests pass.
Threshold tests reproduced comparisons against unreadable/conflicting/missing-state
latest values. The source fix preserves latest-record selection, withholds its number,
and returns not_evaluated rather than resurrecting an older valid value. Five tests pass.
These SQL changes are not deployed. Unit conversion remains separately unresolved:
DT_HARMONIZED_EVENTS currently passes numeric values through; do not claim conversion.
Post-request web access checks withhold revoked/unverifiable patient responses;
connection destruction is awaited and errors propagate. Nine targeted web tests pass.
This does not prove cancellation of an already running Snowflake query.


## Latest offline regression: 657 Python / 283 web

Full Python suite: 657 passed, 14 live-dependent skips, 36 subtests, 4.58 seconds.
Web: 283 passed; TypeScript and production build passed. Generated 11-file deployment
bundle rebuilt. All recent SQL fixes below are source-only because the warehouse cap
prevents compilation/runtime verification here.

- Mixed dashboard views require every included consent category. Context needs identity
  and clinical; mixed history/raw document/packet/snapshot/task views also need financial.
  Specific factual domains retain category-specific checks. Workspace names require identity;
  mixed queue/census views require all three. Narrowed consent can intentionally hide a view.
- Unknown/mixed/null document types are not assumed clinical. Existing cbc_report and
  discharge_note aliases remain recognized; consent_form requires identity.
- ANC requires matching patient, encounter, specimen and event time; one valid differential;
  canonical compatible units; both source/ingestion clocks. Foreign direct ANC cannot suppress it.
- Registered unit factors are applied before plausibility checks; already canonical values
  are not multiplied again. Normalized unit accompanies value through answers and record views.
  Unregistered values retain original units; unit-bearing simple rules reject incompatible units.
- Simple thresholds reject latest unreadable/conflicting/unknown-state values without falling
  back to older evidence. Multi-input rules reject unsupported units; CrCl does not assume
  male for an unknown recorded sex or compute with invalid age/nonpositive creatinine/weight.
- Rule selection filters effective periods and chooses latest applicable version per rule.
  Mutable CORE patient/encounter/plan/identity/coverage/authorization/clinical rows are read
  at a UTC Time Travel cutoff; expiry is measured at that cutoff. READINESS returns a clocked
  error if snapshot dependencies fail. Derived-table historical reconstruction still needs
  adversarial runtime proof; these source tests are not Snowflake compilation evidence.

Platform references checked 5 October:
https://docs.snowflake.com/en/sql-reference/constructs/at-before
https://docs.snowflake.com/en/developer-guide/snowflake-scripting/cursors
Decision: explicit UTC typed snapshot, bound cursor cutoffs, no current-data fallback on error.


## Latest checkpoint: 663 Python / 286 web, private inference compilation

Full Python: 663 passed, 14 skipped, 36 subtests (7.25 seconds). Web: 286 passed.
Typecheck/build passed. No tests skipped because of code failures.

The web boundary now checks a SQL-derived opaque fingerprint of binding, patient,
consent and data categories both before and after an operation. It withholds changed
scope and purges retained patient state. ASK_SAARTHI also performs that check around
refusal, fallback and native inference, protecting direct MCP callers. Inference is a
private helper; legacy non-JSON output is wrapped for the existing bounded candidate
parser and deterministic validator, never displayed directly. Scope fingerprint,
updated gateway and normalization table still require integrated deployment.

Actual Snowflake metadata-only proof, without warehouse execution:
- Private ANSWER_GATEWAY_INFER compilation: 01c78415-0004-0d3e-0001-fe5a00171086.
- SHOW GRANTS: 01c78415-0004-0d3e-0001-fe5a0017108e; one OWNERSHIP row for ACCOUNTADMIN,
  no APP/PUBLIC grant. Old gateway remains active; no incomplete pipeline switch.
- Normalization SELECT EXPLAIN: 01c78418-0004-0e08-0001-fe5a00170c4e, succeeded.
  Planner explicitly includes patient/specimen/time joins, conversion and anti-join.
  This is compilation, not computed values, dynamic refresh validation or model execution.
CrCl unit/age/recorded-sex guards pass behavioral tests; completed years use the birthday
at the snapshot. The deployment bundle installs updated harmonization before readers.

Source reference checked 5 October:
https://docs.snowflake.com/en/sql-reference/sql/explain
EXPLAIN compiles without executing; it does not require a running warehouse.
Required remaining work includes cancellation/concurrency proof and any resulting fixes,
independent/native execution, connected ingest, clean install, hosting and observed impact.
Do not report that final model tuning is the only unfinished axis.

## 5 October, 07:10 IST — bounded context and concurrent search harness

- Full Python: 679 passed, 14 live-dependent skips, 36 subtests, 5.57s.
- Frozen-clock context collector and corrected patient-search dispatcher compiled successfully.
  Packer and inference compiled; private grants remain ownership-only. Full receipt table:
  evidence/qa/COPILOT-CONTEXT-2026-10-05.md. Nested retrieval/inference is not runtime-proven.
- Thirteen context tests pass, including one clock across sections, isolated dependency failure,
  separate corpora, bounded payload and the actual two-argument patient-search contract.
- Nine security harness tests pass. Every concurrent worker now checks a nonempty authorized
  Cortex Search control and rejects foreign document/event/patient identifiers. Live run pending.
- Deck r5 is refreshed to 679 Python / 286 web, validated and visually reviewed on changed slide.
  Native PowerPoint remains unverified; inherited template font alias warnings remain.
- Eleven generated deployment files current; source configuration and git diff checks pass.
- 9/20 release gates remain verified. Account execution, hosting, operator/consumption proof,
  in-flight cancellation, simultaneous writes and final video remain open. Portal untouched.

## 5 October, 07:20 IST — deployment health and asset provenance

- Full Python: 684 passed, 14 live-dependent skips, 36 subtests, 6.59s.
  Web: 291 passed; typecheck and production build passed.
- Fixed preflight accepting arbitrary HTTP 200 HTML as backend health. /api/health now requires
  a frozen release hash and a successful restricted SQL read with an actual query ID.
  It discards patient content and redacts dependency errors. Missing configuration returns
  503/no-store; that exact behavior passed against the localhost production build.
  Evidence: evidence/qa/backend-health-local-2026-10-05.json. No hosted-backend pass claimed.
- Preflight requires --release-revision matching the backend response; shell wrapper requires
  SAARTHI_RELEASE_REVISION. HTML preview, different revision and absent SQL receipt fail tests.
- Five of seven reference PDFs now byte-match publisher downloads, including Gujarat GMSCL
  and its AIIMS mirror. FDA direct label download returned 404; NHA origin remains unresolved.
  Effective dates, clinical currency and redistribution permission remain separate limitations.
  Evidence: evidence/qa/reference-publisher-origin-2026-10-05.json.
- Added unmodified publisher font notices. Local TTF metadata confirms OFL 1.1 for Inter 4.000
  and JetBrains Mono 2.304. Material Symbols family licence checked; WOFF2 byte origin unverified.
  The packager previously omitted text notices. A failing test reproduced that; the three exact
  notice paths are now allowlisted while credentials/build exclusions remain intact.
- Deck r6 refreshed to 684 Python / 291 web; package/layout/import passed and changed slide
  visually reviewed. SHA256 58a745f498c1b3d91a34b8f98cd00d38499e97d220572cb207400b0450419db8.
  Inherited template font warnings remain; native PowerPoint is unverified.
- Host package r7 has 167 credential-free allowlisted files, each byte-matched to current source.
  Deployment SQL bundle remains current (11 files), copilot source configuration and diff checks pass.
- Pure context packer CALL was also warehouse-blocked: 01c78441-0004-0e08-0001-fe5a00170f02.
  No AI was called. Metadata compilation is separate from runtime, even for this pure helper.
- 9/20 release gates verified remains unchanged. Final AI tuning is user-owned; other live
  runtime/hosting/operator/economics gates are still required. Portal and billing unchanged.
