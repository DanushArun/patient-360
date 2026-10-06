# SAARTHI Next.js completeness map

Scope: `/` and `/patient/[id]`, compared with `frontend/streamlit_app.py` and
`frontend/core/navigator.py`. This is a validation contract, not a claim that the app is
finished. Last mapped: 23 September 2026.

## Decision from the 23 September live audit

**No: the Next.js dashboard is not an end-to-end Patient 360, and it is not ready for a
hospital integration.** It has a usable synthetic-patient census, readiness strip, question
entry, evidence summary, checklist, and one review-task creation path. Its main view does not
show the longitudinal record or the actual source behind most gate results. The repository's
own architecture specifies six application workflows; the Next.js app exposes the census and
one combined patient page. A judge could reasonably call the current visual scope incomplete.

This verdict is about demonstrated software, not clinical efficacy. There is no basis here for
a claim that the system will win a competition or improve patient outcomes. The latter needs
hospital partner evaluation and clinical validation, beyond synthetic engineering checks.

### Backend readiness — what the Next.js dashboard can depend on

Legend: 🟢 built + live-verified on JN89282 · 🟡 partial · ⚪ designed-only.
Every 🟢 below is proven by a query ID, a passing test run, or a live procedure return
that a reader can reproduce from the repository. This section does NOT claim the
frontend renders any of it — that is what the tables in the rest of this document audit.

| Backend capability | Status | Proof |
| --- | --- | --- |
| 35 tables, 4 dynamic tables, 6 tasks, 2 Cortex Search services, 1 semantic view, 1 agent | 🟢 | `check_gate.py --manifest` PASS, 55 active deploy steps |
| All 16 rule evaluators returning real outcomes | 🟢 | `run_rule_fixtures.py` 28/28 PASS (16 deep-case + 12 scratch harness) |
| 12 of 100 patients (deep case + 11 daycare cohort, each with distinct blocker) | 🟡 | `SELECT COUNT(*) FROM PATIENT` = 12; DC-04 → `CLIN-PLT-001 fail` verified |
| 10 of 13 SPEC §14 corruption scenarios | 🟢 | Deep case: 2/3/12 · Scratch: 7/8 · corruptions.py: 13 · load_synthetic: 1/4/5/6/9/10 |
| MCP server exposed as `CORTEX_AGENT_RUN`, external round trip via PAT | 🟢 | Query ID `01c74481-0003-92e6-0001-fca600116122`; `docs/MCP-QUICKSTART.md` reproduces |
| Insurance + government schemes (PM-JAY / TN-CMHIS / MH-MJPJAY) with COV-AUTH letter drift | 🟢 | `EVALUATE_GATES` returns `conflicting` on `PA-DEEP-0002` (SPEC §247 flagship) |
| FHIR R4 bundle per patient → RAW_FHIR_BUNDLE → flatten_fhir_proc live | 🟢 | 149 resources across 12 bundles; flatten returns `events_written: 0, pending_bundles: 12` (idempotent path proven) |
| Two-corpus Cortex Search (patient docs + reference: WHO + NCD, 159 chunks) | 🟢 | Cited answers via `ASK_SAARTHI` on reference queries |
| RAP keyed on `CURRENT_USER()` with reference-scope OR-branch | 🟢 | F3 verified; SAARTHI_JUDGE negative test rejected at schema layer |
| CoCo lifecycle: Planning + Development + Execution + Testing YAMLs | 🟢 | `evidence/coco/*.yaml` — 4 files, 1186 lines total, 9 failure/fix pairs |
| Navigator View + Judge Console UI screens | ⚪ | Not built; backend Judge probes exist as SQL |
| Frontend → live-backend wiring (4 built screens still read fixtures) | ⚪ | Streamlit renders fixtures, not the live tool procedures |
| R7 two-pass extraction fired end-to-end (task deployed, queue empty) | ⚪ | Awaits real patient PDF upload |

**The frontend gaps in the tables below remain honest.** A backend that returns
`CLIN-PLT-001 fail` correctly does not mean the UI shows it clearly, cites the source
row, or lets a coordinator escalate to a named owner. This block is provenance for what
the UI *can* show, not proof that it does.

### Evidence actually observed

All patients below are synthetic. This is a **small smoke run**, not coverage of every state.

| Run | Observation | Result and limit |
| --- | --- | --- |
| V-01 | Opened `PAT-DC-04`; SQL snapshot appeared, then live readiness | 13 live rule tiles were visible, including a platelet fail. This proves one patient load and refresh, not all patients or access controls. |
| V-02 | Opened `ID-LINK-001`, `COV-AUTH-001`, and `DOC-HER2-001`; queried `READINESS_STATE` | Each showed rule, outcome and reason, but said **“No source evidence ID was returned.”** A read-only query found **9 of 13** `PAT-DC-04` rules with zero evidence IDs, query `01c744a5-0003-92e2-0001-fd06003500e2`. The bespoke-rule return in `backend/sql/procedures/evaluate_gates.sql:475` constructs an empty evidence array. |
| V-03 | Sent “Which source supports the HER2 documentation check?” | User text appeared immediately; live answer explicitly said no source was cited. It showed `known_as_of` and tool query `01c7449f-0003-92e2-0001-fd060034ae0a`. This is a good refusal to fabricate proof, while still exposing a product gap. |
| V-04 | Escalated the `CLIN-PLT-001` fail | UI returned task `c9af42af-8268-419e-83c3-02717d131733`. Read-only query `01c744a4-0003-92e6-0001-fd060034e522` confirmed `PAT-DC-04:CLIN-PLT-001`, `escalate`, `open` and the stable idempotency key in `REVIEW_TASK`. Assignment, history, replay and role denial remain open. The button had no visible pending state during the server wait. |
| V-05 | Opened the checklist and changed Bengali to Hindi | Checklist item and copyable family message changed language. The other three languages, copy action, and missing prerequisites were not exercised. |
| V-06 | Reloaded `PAT-DC-04` | Both the submitted question and assistant answer returned from `sessionStorage`. Other-patient isolation was not exercised. |
| V-07 | Ran `venv/bin/pytest -x --tb=short` | 203 tests passed, then `frontend/tests/test_streamlit_app.py::test_app_runs_offline_without_exception` failed because `streamlit_extras` is imported but absent from the test environment. The suite stopped there. |
| V-08 | Ran `frontend/node_modules/.bin/tsc --noEmit` | Passed. This checks types, not production build or browser behavior. |
| V-09 | Read eight recent `PAT-DC-04` binding rows | All eight had distinct Snowflake session IDs and non-null release times, query `01c744a5-0003-9673-0001-fd060034c9ca`. This is a sample, not a controlled concurrent A/B or failure-path test. |
| V-10 | Requested `/api/patient/PAT-NOT-EXISTS` | Returned HTTP 403 in 3.0 seconds with `bind failed: no_patient_access` and no patient facts. This tests an unknown ID only; a real foreign patient and revoked consent remain open. |

The running Next server logged a roughly 15-second live readiness request and review requests
around 13–17 seconds during this inspection. These are individual observations, not p50/p95
measurements. They do not rebut the reported 20–30 second user experience.

### The actual professional workflow, from worklist to closure

Each step requires a **visible clinical or operational object**, a useful action, and proof
that the action affected the right patient. “There is a table in Snowflake” is not enough.

1. **Find the right patient and visit.** The worklist must show scheduled encounter, place,
   regimen/cycle, urgency, and owner. The picker must include all authorized patients, not
   one hardcoded non-census patient. A denied or revoked patient must never render facts.
2. **Orient to the patient in under two minutes.** A clinician needs current visit and
   treatment plan, a dated facility timeline, recent relevant observations, important
   documents, coverage/authorization, and unresolved conflicts. The current page shows the
   header and gates, but no timeline, chart section, or source-document view.
3. **Inspect every check.** Pass, fail, conflicting and not_evaluated must each explain the
   actual rule version, threshold, inputs, source record, all three clocks, and what is
   missing or conflicting. A pass with no source reference is not proof.
4. **Ask a bounded question.** The user's text must appear immediately. The answer must
   distinguish found, absent, disputed and stale facts, and link each claim to the record.
   Class A requests must route to a named treating practitioner with an evidence packet.
5. **Take ownership of a gap.** Request-document or escalation needs a task ID, actor,
   owner, due state, current status, and later closure evidence. Today only task creation is
   visible. There is no Next.js queue, task history, or return path after filing.
6. **Prepare the family.** The checklist must derive from current gates and visit, show its
   rule origins, support the five drafted languages, and show whether a human reviewed the
   translation. The app copies text but does not send it; that limit must stay explicit.
7. **Reconcile an update.** New document or lab data must pass ingestion, two-family
   verification, rule evaluation, new `known_as_of`, a changed status, and an auditable
   before/after view. The current dashboard has no visible update or change-history journey.

For the clinician's screen, the useful information order is: **patient and current visit →
what needs attention now → recent timeline → source records → actions/history → ask the
record**. The chat stays available throughout. This is a proposed information hierarchy for
the six specified workflows; it has not been implemented or user-tested. A hospital should
validate it with oncologists, coordinators and navigators using realistic cases.

### Object-level visibility that the first map omitted

| Object | The professional needs to see or do | Next.js today | Acceptance proof |
| --- | --- | --- | --- |
| Patient identity + care team + consent | Verify ABHA-linked identity, treating team, facility, consent purpose and validity | Name, ID, consent ID, practitioner only | Authorized, ambiguous, revoked and wrong-facility cases; no name join |
| Encounter + treatment plan | See scheduled chair, cycle, regimen and changes across visits | Current census row; patient header omits visit/regimen | Open same visit from queue; reschedule updates readiness |
| Clinical event | See value, unit, range, event time, recorded time, ingest time and source | Some values embedded in rule reasons | Source record and three clocks open from every clinical gate |
| Document + page | Open actual pathology/lab letter and highlighted cited span | No document route/viewer | Citation resolves to exact patient page and span; scope rechecked |
| Rule + readiness state | Explain threshold, rule version, outcome, inputs and missingness | Outcome, rule ID, reason, partial evidence ID | All four outcomes for all applicable rules; no invented pass |
| Coverage + authorization | Show policy/PM-JAY record, approval letter, dates, amount and scope limits | Summary rule reason only | Compare database state with source letter and disclose family-floater limit |
| Review issue + task | Assign, acknowledge, resolve and audit the issue | Creates a task; no queue/history | Open issue to task to resolution; retry does not duplicate |
| Answer run + evidence packet | Revisit answer with tool/query IDs, citations and named practitioner referral | Browser-session conversation and tool IDs; no packet view | Persist/replay with as-of; Class A packet can be opened by intended clinician |
| Ingestion run + source system | Know when each source last synced and why a value is absent | No visible integration/freshness status | Show successful, delayed and failed feeds; no silent stale data |

### Scope boundary: hackathon proof versus hospital deployment

The architecture already contains much of the hackathon scope in
`planning/revised-architecture/SPEC.md` §10: Ask + Evidence, Review Queue, Patient 360,
Review + History, Navigator View, and Judge Console. Build and prove those before claiming
the current two-route shell represents the whole product. The repo explicitly limits the
demo to synthetic data, 16 rules, patient-level coverage arithmetic, and a periodic refresh.

A hospital evaluating integration would additionally expect these capabilities. This is a
**product requirement assessment**, not a claim that they are built or that every hospital
uses the same workflow:

- **Interoperability:** ingest and reconcile its HIS/EHR, laboratory, imaging, pharmacy and
  payer data through agreed identifiers and documented mappings. Validate outbound/inbound
  records against the [published ABDM FHIR implementation guide](https://www.nrces.in/ndhm/fhir/r4/toc.html),
  including its Patient, Encounter, DiagnosticReport, DocumentReference and Task profiles.
- **Access and consent:** hospital identity/SSO, role and facility scoping, consent purpose,
  expiry and revocation, plus a usable access-review trail. The
  [ABDM health data policy](https://abdm.gov.in/static/media/health_management_policy_bac9429a79.80f74bc3e039c00acd4f.pdf)
  describes consent records and revocation notification; the
  [MoHFW EHR standards](https://www.mohfw.gov.in/sites/default/files/EMR-EHR_Standards_for_India_as_notified_by_MOHFW_2016.pdf)
  call for auditable health-record access, including viewing.
- **Clinical governance:** hospital-approved rules and version changes, named accountable
  clinicians, evaluation on representative local cases, review of harmful failures, and
  monitoring for data quality. Synthetic rule tests are engineering evidence only.
- **Operations:** clear feed health, retry/reconciliation, retention, backup, incident
  response, latency and uptime targets, support ownership, and migration/rollback plans.
- **Workflow fit:** a complete longitudinal chart, task assignment/closure, source viewer,
  and clear handoffs to coordinators and family navigators inside the hospital's existing
  work rather than a parallel dashboard that creates unresolved tasks.

The priority is to close the demonstrated loop for one synthetic patient, then broaden to
the six specified workflows. Expanding into a generic EHR before that loop works would
increase the surface area without proving the core value.

### Citizen benefit must be measured

Potential benefits are fewer avoidable journeys for missing prerequisites, quicker resolution
of evidence or authorization gaps, and less time spent by clinicians reconstructing a chart.
The current synthetic demo proves none of these outcomes. A partner evaluation should record
absolute case counts alongside rates for: missing prerequisites detected before travel,
incorrect or missed alerts, time to review a patient, time from issue to owner and closure,
source-citation resolvability, consent/access failures, translation corrections, and patient
or caregiver comprehension. Compare against the hospital's existing workflow, and record
adverse and ambiguous cases rather than excluding them.

### Ordered release work

| Priority | Work | Exit evidence |
| --- | --- | --- |
| P0 — credibility and safety | Use the intended app role; make every gate's provenance resolvable or mark it unsupported; expose the actual record behind a citation; complete denied, revoked, concurrent A/B and failure cleanup tests | Query IDs, source viewer, access probes, no leaked rows, no unsupported pass presented as sourced |
| P1 — clinical workflow | Add the specified Patient 360 timeline and visit context, review queue, task owner/status/history, answer history and Class A packet view | Clinician and coordinator can move from queue to source to action to closure on one case |
| P2 — build proof | Run one document → parse → two-pass verify → assertion → rule → cited answer flow, then corruption and held-out evaluation; repair the Streamlit test environment and add browser regression coverage | Repeatable run artifacts with absolute counts, failures, query IDs, screenshots, cold/warm timings |
| Hospital pilot | Integrate one facility's source systems, identity and consent, audit and operational support under hospital governance | Partner sign-off, representative-case validation and incident/rollback rehearsal |

## How to use this map

- **Code-backed** means the behavior has an implementation path. It does not mean it was
  exercised in a browser or against Snowflake.
- **Gap** means source inspection found missing or different behavior.
- **Open** means the outcome needs a fixture, browser run, database audit, or measurement.
- Mark a row **verified** only with a dated run, patient or fixture, observed result, and
  screenshot, trace, query ID, or automated assertion. A screenshot of a loading skeleton
  does not verify a loaded patient page.
- A journey is complete only when its normal path, empty or denied path, and relevant failure
  path pass. Every visible control must have a state change or an explicit error.
- Use synthetic patients only. Recorded fixtures show what existed at capture time; live
  outcomes must be checked again because readiness and encounter dates can change.

## Homepage and navigation

| ID | User action / state | Required visible result | Source | Status and proof needed |
| --- | --- | --- | --- | --- |
| H1 | Open `/` with accessible visits | Day groups; Ready, Advisory, Waiting, Conflict, Blocked counts; blocker-first rows with patient, regimen, status, reason, `Open` | `frontend/app/page.tsx`, `frontend/lib/census.ts`; Streamlit `_render_census` | Code-backed. Compare counts and row order against one `READINESS_STATE` capture. |
| H2 | Open patient picker; choose any listed patient | Picker contains every accessible patient; choice opens that patient's page | `frontend/app/page.tsx:10-37,72-83`; Streamlit header selector | **Gap:** picker inherits only census patients plus a hardcoded Meera row. Query all bindable patients and verify every option. |
| H3 | Click a census row's `Open` | Patient route starts loading immediately, then shows the selected patient, never a different binding | `frontend/app/page.tsx:189-197`, `frontend/app/patient/[id]/page.tsx` | Code-backed; browser click plus patient ID/name assertion open. |
| H4 | No visits in seven days | Explicit empty message; accessible patient picker still works | `frontend/app/page.tsx:125-130` | Code-backed; controlled empty census fixture open. |
| H5 | Snowflake census failure | Explicit error, no misleading zero-count success state | `frontend/app/page.tsx:49-57,116-123` | Code-backed; inject connection failure and capture UI. |
| H6 | Desktop and narrow viewport | No clipped rows, count labels, picker, or `Open` controls; keyboard focus visible | `frontend/app/page.tsx`, `frontend/app/globals.css` | Open; capture both widths and tab order. |

## Patient record and every readiness check

| ID | User action / state | Required visible result | Source | Status and proof needed |
| --- | --- | --- | --- | --- |
| P1 | Open authorized `/patient/[id]` | Name, patient ID, consent, practitioner, readiness, conversation/evidence columns, composer | `frontend/app/patient/[id]/page.tsx`, `patient-client.tsx:73-85,267-305` | Code-backed; full page capture after load. |
| P2 | Initial SQL snapshot, then live refresh | Snapshot clearly labelled with `known_as_of`; live result replaces it; no stale result labelled current | `frontend/lib/patient.ts:39-85`, `patient-client.tsx:249-283` | Code-backed; record both states and timestamps. |
| P3 | Live readiness unavailable | Snapshot remains labelled; error and retry appear; empty snapshot states no inferred outcome | `patient-client.tsx:269-283` | Code-backed; force refresh failure, then retry success. |
| P4 | Bind denied or unknown patient | No patient facts or gates; access/error page shown | `frontend/lib/snowflake.ts`, `frontend/app/patient/[id]/page.tsx` | Open; use unauthorized synthetic ID and inspect response/body. |
| R1 | Click **each** readiness tile, including identity, coverage, documentation | Selected tile and evidence panel agree on category, outcome, rule/version, severity, reason, evidence IDs, as-of, derived value when supplied; second click or Clear selection unpins | `patient-evidence.tsx:9-40,73-107` | Code-backed; run rule matrix below. |
| R2 | Click a `pass` tile | Explain why it passed; no review action | `patient-evidence.tsx:73-105` | Code-backed; browser assertion per category open. |
| R3 | Click a `fail`, `conflicting`, or `not_evaluated` tile | Exact SQL outcome and reason; missing evidence stated; two permitted actions visible | `patient-evidence.tsx:73-123` | Code-backed; browser assertion per available outcome open. |
| R4 | Tile or answer carries `provenance_note` | Show the provenance note with the gate's evidence | Streamlit `streamlit_app.py:578`; Next `patient-evidence.tsx:73-93` | **Gap:** Next gate detail does not render `provenance_note`. |
| R5 | No readiness rows | Explicit unavailable state; no “pass” inferred from absence | `patient-client.tsx:281-283`, `frontend/lib/census.ts:106-107` | Code-backed; controlled missing-row fixture open. |

The rule matrix is the click inventory. For **every row**, check the tile and side panel,
including pass and every available non-pass outcome. Expected reason and evidence IDs come
from the selected SQL row, never from a guessed UI string. Sample patients are from
`frontend/fixtures/daycare_census_recorded.json`, recorded 23 September 2026; they are
fixture targets, not promises about today's live database.

| Category | Rule | Recorded sample outcome → patient | Coverage needed |
| --- | --- | --- | --- |
| Identity | `ID-LINK-001` | pass → `PAT-DC-09` | Pass plus denied/ambiguous identity fixture |
| Identity | `ID-QUAR-001` | pass → `PAT-DC-09` | Pass plus quarantined identity fixture |
| Coverage | `COV-AUTH-001` | pass → `PAT-DC-09`; not_evaluated → `PAT-DC-06`; conflicting → `PAT-DC-07` | All three; fail fixture if supported |
| Coverage | `COV-LIMIT-001` | pass → `PAT-DC-09` | Pass plus limit-fail fixture |
| Documentation | `DOC-DISC-001` | pass → `PAT-DC-09` | Pass plus discordance fixture |
| Documentation | `DOC-HER2-001` | pass → `PAT-DC-04`; not_evaluated → `PAT-DC-10` | Both |
| Documentation | `DOC-PATH-001` | pass → `PAT-DC-09` | Pass plus missing-pathology fixture |
| Clinical | `CLIN-ANC-001` | pass → `PAT-DC-09`; fail → `PAT-DC-03`; not_evaluated → `PAT-DC-08` | All three |
| Clinical | `CLIN-PLT-001` | pass → `PAT-DC-09`; fail → `PAT-DC-04`; not_evaluated → `PAT-DC-08` | All three |
| Clinical | `CLIN-CRCL-001` | pass → `PAT-DC-09` | Pass plus unavailable/failed fixture |
| Clinical | `CLIN-BILI-001` | pass → `PAT-DC-09` | Pass plus unavailable/failed fixture |
| Surveillance | `SURV-LVEF-001` | pass → `PAT-DC-06`; fail → `PAT-DC-02` | Both |
| Surveillance | `SURV-LVEF-002` | pass → `PAT-DC-02` | Pass plus non-pass fixture |
| Endocrine | `ENDO-HBA1C-001` | pass → `PAT-DC-04`; fail → `PAT-DC-09` | Both |
| Endocrine | `ENDO-DEXA-001` | pass → `PAT-DC-04`; not_evaluated → `PAT-DC-09` | Both |

## Conversation and evidence journey

| ID | User action / state | Required visible result | Source | Status and proof needed |
| --- | --- | --- | --- | --- |
| C1 | Focus and type in composer | Single smooth surface and visible focus ring; typed text stays visible; send control reachable by keyboard | `patient-client.tsx:164-173`, `frontend/app/globals.css` | Code-backed; desktop/mobile focus screenshot and tab test open. |
| C2 | Submit by Enter or Send | User message appears immediately, input clears, `Consulting the record…` appears, duplicate send disabled | `patient-client.tsx:131-143,197-215` | Code-backed; browser/network timeline open. |
| C3 | Successful `ASK_SAARTHI` | Assistant text, `known_as_of`, cited gate outcomes/rules, tools/query IDs, suggested follow-ups visible | `frontend/lib/patient.ts:118-171`, `patient-client.tsx:146-162`, `patient-evidence.tsx:126-157` | Code-backed; controlled response and live query ID open. |
| C4 | Click suggested follow-up | Exact suggestion becomes visible user turn and new request; no patient ID in agent input | `patient-client.tsx:141-143,204-212` | Code-backed; browser request assertion open. |
| C5 | Click answer `Evidence`, then unpin | Panel follows clicked rule; shows reason, evidence IDs, derivation, tool provenance; unpin returns to answer overview | `patient-client.tsx:290-303`, `patient-evidence.tsx:42-71` | Code-backed; click two rules in one category to catch key collisions. |
| C6 | Expand reasoning | Disclosure opens; states reasoning is inspectable but not evidence | `patient-evidence.tsx:150-158` | Code-backed; fixture with thinking block open. |
| C7 | Reload or switch patients | Turns restore for same patient in browser session; other patient has separate history | `patient-client.tsx:175-195,244-260` | Code-backed; reload and A→B→A assertions open. |
| C8 | Malformed/empty agent response | User turn remains; no invented answer; specific `malformed_agent_json` or `nothing_found` shown | `frontend/lib/patient.ts:118-163`, `patient-client.tsx:18-22,153-159` | Code-backed; inject both response shapes. |
| C9 | Transport/procedure error | User turn remains and actionable error is visible after failure and reload | `patient-client.tsx:208-215`; Streamlit `streamlit_app.py:356-362` | **Gap:** Next collapses errors to `agent_unreachable`; inline error is not saved as a turn, so reload loses it. |
| C10 | Class A clinical question | Refusal with practitioner evidence-packet path; no clinical recommendation | Architecture `AGENTS.md` §5; `ASK_SAARTHI` behavior | Open; adversarial live or recorded agent response plus SQL evidence. |

## Family checklist and review actions

| ID | User action / state | Required visible result | Source | Status and proof needed |
| --- | --- | --- | --- | --- |
| F1 | Open Family checklist with visit and gates | Correct visit, deterministic rule-derived items, originating rule IDs, copyable message, disclaimer | `patient-client.tsx:36-70,88-129`; `frontend/core/navigator.py` | Code-backed; compare item keys/order and message against Python for same gates. |
| F2 | Select English, Hindi, Tamil, Bengali, Marathi | Message and checklist text change; header/date/name and always-bring text match selected language | `frontend/lib/navigator-data.json`, `patient-client.tsx:108-127` | Code-backed; five-language text assertions open. |
| F3 | Copy message; clipboard unavailable | Clipboard contains exact visible message; success or selectable-text fallback appears | `patient-client.tsx:99-127` | Code-backed; success and denied-clipboard runs open. |
| F4 | No upcoming visit or readiness | Specific prerequisite message; no fabricated preparation advice | `patient-client.tsx:95-96`; Streamlit `streamlit_app.py:467-474` | Code-backed; two controlled fixtures open. |
| A1 | Select actionable gate, choose Request document or Escalate | Task ID appears, tied to bound patient and rule; only these two actions are offered | `patient-evidence.tsx:95-123`, `frontend/lib/patient.ts:174-197` | Code-backed; one success per action with `REVIEW_TASK` row/query ID open. |
| A2 | Retry same action | Same task returned; no duplicate row | `frontend/lib/patient.ts:189-195`, SQL `08_create_review_task.sql:58-69` | Code-backed; database count and `idempotent_replay` check open. |
| A3 | Try pass gate, invalid action, wrong role, or revoked access | No task; precise refusal surfaced to user | `frontend/lib/patient.ts:180-187`, SQL `08_create_review_task.sql:21-55` | Code-backed for server checks; route/UI currently generalize some exceptions. Exercise each denial. |

## Patient scope, timing, and visual acceptance

| ID | Invariant or measurement | Required evidence | Status |
| --- | --- | --- | --- |
| S1 | Every patient data request opens a fresh session, runs `USE SECONDARY ROLES NONE`, binds before reads/writes, releases binding, closes connection | Instrument GET, ask, review success/failure and assert session IDs differ with `released_at` set | Partial: eight recent `PAT-DC-04` rows had distinct session IDs and release times (V-09). Failure paths and connection-close completion remain open; `destroy()` is not awaited in `frontend/lib/snowflake.ts`. |
| S2 | Concurrent patient A/B requests cannot cross scope | Overlap requests; compare Snowflake session IDs, bound IDs, responses, and post-request binding rows | Open; concurrency test required. |
| S3 | Agent gets question only; tool input has no patient identifier | Capture `ASK_SAARTHI(?)` bind and agent tool calls; assert no `patient_id` tool input key | Code-backed at `frontend/lib/patient.ts:166-171`; live trace open. |
| S4 | Census and patient access require active care team/consent; review role checked server-side | Authorized, revoked, foreign patient and navigator-role probes | **Gap:** `frontend/lib/snowflake.ts:20-27` opens with primary `ACCOUNTADMIN`, despite the app-role requirement. Explicit census filters, binding, and review checks exist, but the session's privilege boundary needs correction and live probes. |
| S5 | No confidence score or clinical decision inferred in UI | Inspect loaded pages and Class A response | Code-backed in UI; response probe open. |
| L1 | Homepage and patient are usable without a 20–30 second skeleton | Cold/warm navigation timings: request, first useful content, live readiness completion; p50/p95 and absolute sample counts | Open. Prior informal timing is not a repeatable benchmark. |
| V1 | Streamlit/Next parity at same viewport | Computed fonts, copy, classes, bounding boxes (target about 2 px), screenshots; intentional homepage/composer design differences documented | Open; no comparison artifact yet. |
| V2 | Production readiness | TypeScript, production build, desktop/mobile browser, keyboard, full journey run | Open; `web` has no Playwright suite yet. |

## Release gate and evidence log

The page is **not completeness-verified** while any Gap or Open row above lacks evidence.
Run the readiness rule inventory, browser journeys, Snowflake session/role probes, timing
sample, and visual comparison. Record each result here or in a linked run artifact with:
`ID | date/time | patient or fixture | action | expected | observed | screenshot/trace/query ID |
pass/fail | owner`. Fix failures, rerun the affected row, and preserve the failure/fix pair.

Current evidence: V-01 through V-08 above are limited live and test observations. No complete
multi-patient, document-to-answer, access-control or task-lifecycle run has passed. Keep the
release gate closed until those paths and the open rows above have dated evidence.
