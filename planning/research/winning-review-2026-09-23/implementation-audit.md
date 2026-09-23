# SAARTHI implementation audit — 23 September 2026

The strongest competition move is to finish and prove one narrow end-to-end workflow.
The repository contains substantive implementation, but its central safety and evidence promises
are not yet connected through the current live answer path. Additional breadth will not close this.

This audit inspected the working tree, including ongoing uncommitted work. It did not modify product
code, deploy SQL, call a live model, alter an account, or test real patient data. Findings below are
source findings unless marked as locally executed or previously recorded. They are not claims of
an exploited live account. Line references describe the snapshot inspected on 23 September.

## What exists, and what is actually proven

| Area | Observed state | Evidence limit |
|---|---|---|
| Synthetic generation | Ledger, PDFs, FHIR, corruptions, rule oracles | 73 local tests passed |
| Data platform | Table DDL, roles, policies, ontology, 16 rule rows, active manifest | Not redeployed |
| Structured readiness | Clinical-event normalization and simple SQL thresholds | Partial evaluator |
| Document ingestion | Parse procedure, two extraction models, assertion writes | Separate from gates |
| Retrieval | Eight generic tools; server-side patient binding; separate corpora | Controls have gaps |
| User interface | New live connection, bind, ask, tool/query-ID display | Contract not enforced |
| Evaluation | Five SQL test files, manifest, local generator tests | No completed held-out report |
| Navigator and schemes | Schema and plans | No working patient bring-list or eligibility workflow |

The status ledger is materially stale: it says no deployment occurred and all screens use fixtures,
while the active manifest and current frontend contain much newer work. See
[IMPLEMENTATION-STATUS.md:18][status] and [frontend/streamlit_app.py:65][app]. Conversely, having code
or an active manifest line does not prove a clean deployment or a tested feature.

The evidence log records 4/4 PDFs parsed and an ANC calculation of 2100 on 21 September, but several
new rows say "see run" instead of supplying query IDs. These are prior team reports, not fresh
verification performed by this audit. See [verification-query-ids.md:174][queries].

## Local verification performed

Executed from the repository using its existing `venv/bin/python` on 23 September 2026:

1. `venv/bin/python -m pytest -x --tb=short frontend/tests backend/tests/generator -q`
   returned **34 passed, 1 failed**, then stopped as requested by `-x`. The failing page test loads
   the deleted `frontend/pages/1_Ask_and_Evidence.py`. The current rewrite moved these pages into
   `_superseded` and uses `streamlit_app.py`. This is a current integration-test failure, not proof
   that the underlying functions all fail. See [test_ask_and_evidence_page.py:28][page-test].
2. `venv/bin/python -m pytest -x --tb=short backend/tests/generator -q`
   returned **73 passed in 0.45 seconds**. This proves the local synthetic-generator/oracle behavior
   exercised by these tests. It does not test the deployed SQL against those oracles.
3. `venv/bin/python backend/scripts/check_gate.py --all --strict`
   returned **18 passed, 8 failed, 0 skipped**. All eight failures are preamble checks. Some are
   expected design exceptions or formatting drift; they must not all be reported as eight security
   vulnerabilities. Actual missing-consent cases are documented separately below. The manifest
   check found **41 active deploy steps**, each pointing to an existing file.
4. A local, in-memory call to `parse_agent_response` with synthetic payloads established:
   - Uncited numeric text with no tools returns that text, `error=None`, `known_as_of=None`.
   - A tool result containing `error: access_withdrawn` followed by answer text retains the text
     and still returns `error=None`.

No Snowflake SQL suites were executed, because they can mutate fixtures, bindings, and account
state. No performance, accuracy, security-isolation, clinical, or deployment success rate follows
from these local results.

## P0 — complete the enforced answer path

### 1. Classification and validation exist but the live entrypoint bypasses both

[ask_saarthi.sql:19][ask] constructs the question, calls `DATA_AGENT_RUN`, and returns its raw
response. It never calls `CLASSIFY_QUESTION`, `VALIDATE_ANSWER`, the frozen answer-schema checker,
or an answer-run persistence procedure. The agent's response and orchestration instructions carry
the safety rules as prose at [saarthi_agent.sql:21][agent].

The intended classifier explicitly says a refusal depending on the agent choosing to refuse is
not a control. See [classify_question.sql:4][classifier]. That is presently the live situation.

The frontend parser collects agent text and optional tool metadata. It does not enforce a claim
schema, citations, classification, or tool-error suppression. The UI renders `turn["text"]`
directly. See [live.py:90][live-parser] and [streamlit_app.py:224][app-answer].

**Completion test:** a Class A request must make no retrieval calls; a fabricated numeric answer
must never reach the display; an access-withdrawn tool result must clear usable context and suppress
answer text. Prove these through the same entrypoint and UI used in the demonstration.

### 2. The validator is narrower than its six-check description

[validate_answer.sql:40][validator] checks evidence existence, patient identity, ingestion cutoff
for structured events, and conflicting/unverified document assertions. Its body does not compare
the claim's asserted numeric value to the cited value, check polarity, call `AI_FILTER`, enforce
document supersession/ingestion cutoff, or require a derivation for computed claims.

Recognizing an evidence kind is not the specified numeric type/value check. A real event ID is
insufficient to establish that the answer states that event's actual value. Wire the validator into
the outer path only after closing these gaps; otherwise integration merely certifies weak checks.

### 3. The document-to-rule bridge is missing

The extraction procedure writes to `EVIDENCE.ASSERTION` at
[extract_assertions.sql:178][extraction-write]. `DT_HARMONIZED_EVENTS` reads only `CLINICAL_EVENT`
at [01_harmonized_events.sql:17][harmonized]. The current structured loader inserts events from
CSV staging at [transform_structured_events.sql:37][transform].

There is no implemented reconciliation/promotion step linking verified assertions to these rule
inputs; the manifest explicitly marks `reconcile_evidence.sql` and `refresh_readiness.sql` as not
built at [setup.sql:210][setup-tasks]. `EVIDENCE_LINK` has a table definition but no current writer
in the inspected product SQL.

Therefore "the PDF was parsed" plus "the ANC gate works" does not prove that the parsed PDF drove
the gate. The currently supported claim is two separate partial paths.

**Completion test:** ingest a new synthetic document with a value absent from structured fixtures;
trace its assertion ID to the SQL input, gate result, answer claim, and source passage. Change the
document and prove a corresponding change without manually editing clinical-event rows.

## P0 — close scope and identity gaps before claiming governed retrieval

### 4. Revocation is not checked by every patient tool

`GET_CHANGES` resolves binding and care team, then returns patient events without querying CONSENT.
See [07_get_changes.sql:30][changes]. `CREATE_REVIEW_TASK` likewise checks binding, care-team role,
and action, then inserts the supplied issue ID without a consent check or verification that the
issue belongs to the bound patient. See [08_create_review_task.sql:24][review-task].

Calling either directly after consent revocation can bypass the check performed by another tool.
This is a source-level path; the deployed behavior has not been exercised in this audit.

The common consent design is otherwise a useful foundation: binding, current caller, care team,
purpose, facility/organization, validity, and binding release are implemented in the main read
tools. See [02_get_readiness.sql:29][readiness]. Make the common authorization behavior executable
and testable across every patient operation, including writes.

### 5. Internal procedures are exposed through blanket application grants

[03_grants.sql:26][grants] grants the app role usage on all present and future OPERATIONAL
procedures. This includes `EVALUATE_GATES(patient_id, encounter_id, ...)`, which runs as owner and
queries the supplied patient's events without caller authorization.
See [evaluate_gates.sql:23][gate-evaluator].

Removing patient IDs from the agent's tool schemas protects that surface, but does not restrict
direct SQL calls made using the app role. Restrict grants to approved entrypoints and apply
authorization at every reachable boundary. Prove with a dedicated non-owner app user.

The current frontend also selects governed tables directly, while the manifest grants only
procedure usage. See [live.py:195][live-session] and [03_grants.sql:23][grants]. A developer/admin
connection can conceal this least-privilege deployment problem.

### 6. The app caches one database session globally

[streamlit_app.py:65][app] caches `_session()` with no session scope or user-specific arguments.
The installed Streamlit implementation documents that default global resources are shared across
users and sessions. `PATIENT_BINDING` is keyed on the resulting Snowflake `CURRENT_SESSION()`.

This creates a source-level risk that one browser's patient selection changes another browser's
subject when both share the same cached connection. It also leaves production caller identity
unproven. The project's own evidence log still marks identity inside deployed Streamlit as
unverified at [verification-query-ids.md:184][queries].

**Completion test:** two simultaneous browser sessions, two real test users, different bindings,
and a patient switch in one session. The other session must remain unchanged; each backend call
must identify the expected principal. No cross-session exploit was run during this audit.

### 7. Federated identity rules are not enforced in structured loading

The structured transformer joins `ID_MAP` solely on `source_patient_id`, without source-system
qualification or excluding quarantined links. This repeats at lines 17, 32, 73, and 88 of
[transform_structured_events.sql][transform]. The parser instead obtains patient ID from the
stage path at [parse_documents.sql:31][parse].

The current one-patient synthetic fixture may avoid collisions. That does not establish R4.
Use a collision fixture where two facilities reuse a local identifier, plus a quarantined mapping;
both cases must demonstrate that evidence cannot land on the wrong patient.

## P1 — make evidence and temporal behavior match the promises

### 8. Rule rows are not sixteen working rule implementations

[evaluate_gates.sql:54][gate-evaluator] selects only rules with a `threshold_json:concept` key.
This includes five current rows; only ANC, platelets, and HbA1c have flat operators handled by the
implementation. LVEF recency has no operator and becomes `not_evaluated` even when evidence exists;
DEXA requires a bespoke evaluator. The other rule shapes are omitted from the result entirely.

Consequently the current output does not implement the promised clinical, documentation,
financial, safety, and administrative gates. The evaluation also does not filter by rule
applicability, rule effective version, verification state, or normalized plausibility state.

At [01_harmonized_events.sql:24][harmonized], the code carries the raw numeric value unchanged
despite comments describing conversion factors. It labels implausibility but the gate evaluator
does not reject that state. ANC derivation uses WBC and neutrophils, not band percentage, and its
timestamp comes from the WBC row rather than the latest contributing input.

Choose a defensible rule subset and report it accurately. Match SQL to the independent oracle
with boundary, missingness, conflict, unit, expiry, and applicability cases before widening scope.

### 9. Two model families share one OCR bottleneck

The code explicitly acknowledges that both models read the same already-parsed page text.
See [extract_assertions.sql:10][extraction]. Agreement therefore tests interpretation consistency,
not whether the original pixels were correctly read. Do not claim independently verified OCR.

The second pass sees the first answer and marks verification from its `agrees` boolean; the code
does not independently compare `value_found` or check `not_present`. Unknown ontology matches can
fall through to `single_pass`. See [extract_assertions.sql:143][extraction].

The parser labels all ingested documents `lab_report` and infers low quality from a filename.
The extractor applies one generic lab prompt, does not save specimen/accession identity, and does
not populate character offsets. These limitations particularly affect cross-specimen pathology
and the source-highlight promise. See [parse_documents.sql:75][parse] and
[extract_assertions.sql:178][extraction-write].

### 10. `known_as_of` is sometimes a label rather than an enforced cutoff

Patient search resolves the cutoff but its search filter contains only patient ID; the refetch
contains only doc ID and page. There is no ingestion cutoff, active-version filter, or consent
date/category restriction in that retrieval. See [03_search_patient_documents.sql:73][search].

Patient facts filter ingestion time for labs but not coverage, treatment plans, or encounters.
See [01_get_patient_facts.sql:95][facts]. Reference search computes a jurisdiction filter but does
not add it to the payload, and does not use the requested effective date.
See [04_search_reference_documents.sql:31][reference-search].

A convincing late-addendum demonstration needs new-versus-superseded evidence and replay before
and after ingestion, with expected answers fixed in advance. Returning an as-of timestamp alone
does not prove temporal correctness.

## P1 — finish the family-facing outcome and judge handoff

### 11. The live UI shows provenance metadata, not the promised claim-to-source workflow

The current margin shows tool names/query IDs and gate evidence IDs. It does not call `page_text`,
render source passages, or invoke the claim/highlight builders used by the older fixture UI.
Tool-result bodies are dropped when the turn is stored. See [streamlit_app.py:284][app-evidence]
and [streamlit_app.py:361][app-input]. These query IDs are useful execution provenance, but they
do not substitute for a user-visible source supporting each claim.

The unbound queue always reads `review_queue.json`, including when `live` is true.
See [streamlit_app.py:250][app-answer]. Offline answers have a visible recorded-data warning, which
is good; the live home queue needs equivalent provenance or a real query.

### 12. Schemes, bring-list, and escalation remain product gaps

Scheme eligibility, review-queue materialization, and notifications remain commented out in
[setup.sql:201][setup-tasks]. No current main-app branch builds a patient bring-list, eligibility
result, or multilingual navigator output. The evidence-packet table and local fixture helper do
not establish a live delivery workflow to a practitioner.

For the user's stated mission, a useful narrow result is a dated, source-backed preparation list:
missing document, responsible person, receiving facility, and concrete next administrative action.
Any scheme result must distinguish a possible match from verified eligibility or authorization.
Implement the subset already in SPEC, without adding speculative platform breadth.

### 13. Reproduction and evaluation need their own acceptance evidence

The manifest does not include the separate structured-event copy/transform files. Streamlit
deployment, reconciliation, readiness refresh, notification integration, and the skill orchestrator
are not active. The inspected product SQL does not resume the parse/extraction tasks. A deployment
can therefore create objects without producing the demonstrated populated application.
See [setup.sql:152][setup-data] and [setup.sql:238][setup-app].

The SQL test manifest lists far more tests than the five SQL files present. The evaluation question
generator explicitly builds only the first deep-case question, not the promised held-out set.
See [TEST-MANIFEST.md:89][test-manifest] and [eval_questions.py:5][eval-questions].

Record a fresh-account deploy, second idempotent run, fixture load, task activation, least-privilege
app launch, independent SQL-oracle comparison, and scripted end-to-end demonstration. Report
absolute pass counts, latency distributions, cold starts, cost, failures, and evidence IDs.

## What is worth defending after those gaps close

- Typed missingness prevents "not received" from becoming "negative".
- Server-chosen patient context is stronger than asking an agent to infer the subject safely.
- Versioned SQL and an independent synthetic oracle can make rule behavior inspectable.
- Separate patient/reference retrieval reduces one specific source-confusion failure mode.
- Recorded platform failures and fixes show engineering judgment when attached to reproducible tests.
- A source-backed pre-travel preparation workflow has a concrete user and observable value.

These are specific design strengths and implementation opportunities, not validated clinical
benefits or claims of superiority over competitors. The winning submission should demonstrate
them through one coherent path, then accurately state the remaining boundaries.

[status]: ../../../IMPLEMENTATION-STATUS.md#L18
[app]: ../../../frontend/streamlit_app.py#L65
[queries]: ../../../evidence/coco/verification-query-ids.md#L174
[page-test]: ../../../frontend/tests/test_ask_and_evidence_page.py#L28
[ask]: ../../../backend/sql/agent/ask_saarthi.sql#L19
[agent]: ../../../backend/sql/agent/saarthi_agent.sql#L21
[classifier]: ../../../backend/sql/procedures/classify_question.sql#L4
[live-parser]: ../../../frontend/core/live.py#L90
[app-answer]: ../../../frontend/streamlit_app.py#L224
[validator]: ../../../backend/sql/procedures/validate_answer.sql#L40
[extraction-write]: ../../../backend/sql/tasks/extract_assertions.sql#L178
[harmonized]: ../../../backend/sql/dynamic_tables/01_harmonized_events.sql#L17
[transform]: ../../../backend/sql/data/transform_structured_events.sql#L17
[setup-tasks]: ../../../backend/sql/setup.sql#L201
[changes]: ../../../backend/sql/procedures/tools/07_get_changes.sql#L30
[review-task]: ../../../backend/sql/procedures/tools/08_create_review_task.sql#L24
[readiness]: ../../../backend/sql/procedures/tools/02_get_readiness.sql#L29
[grants]: ../../../backend/sql/governance/03_grants.sql#L23
[gate-evaluator]: ../../../backend/sql/procedures/evaluate_gates.sql#L23
[live-session]: ../../../frontend/core/live.py#L195
[parse]: ../../../backend/sql/tasks/parse_documents.sql#L31
[extraction]: ../../../backend/sql/tasks/extract_assertions.sql#L10
[search]: ../../../backend/sql/procedures/tools/03_search_patient_documents.sql#L73
[facts]: ../../../backend/sql/procedures/tools/01_get_patient_facts.sql#L95
[reference-search]: ../../../backend/sql/procedures/tools/04_search_reference_documents.sql#L31
[app-evidence]: ../../../frontend/streamlit_app.py#L284
[app-input]: ../../../frontend/streamlit_app.py#L361
[setup-data]: ../../../backend/sql/setup.sql#L152
[setup-app]: ../../../backend/sql/setup.sql#L238
[test-manifest]: ../../../backend/tests/TEST-MANIFEST.md#L89
[eval-questions]: ../../../data/generator/eval_questions.py#L5
