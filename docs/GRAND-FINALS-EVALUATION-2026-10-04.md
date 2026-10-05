# SAARTHI: judge assessment and deficit elimination

Checkpoint: 4 October 2026, approximately 21:15 IST. This assesses the observed
working tree and bounded runtime checks, not an imagined completed release.
The official rubric specifies only 30/40/30. The allocations below are an internal
judge model; they are not organizer-issued feature points. No fractional deductions
are hidden. Each deduction has one ID and one acceptance gate.

SAARTHI helps a day-care coordinator reconcile patient records, coverage documents,
and missing evidence into a cited worklist for practitioner review.

## Phase 1 — Baseline

| Criterion | Score | Deficit |
|---|---:|---:|
| Real-World Relevance | 25/30 | 5 |
| Technical Execution | 25/40 | 15 |
| Solution Completeness | 17/30 | 13 |
| Total | 67/100 | 33 |

The earlier 66-point assessment gains one technical point for the guarded web
boundary, corrected scoring denominators, passing local checks, and two bounded
live validator tests. It does not gain deployment or evaluation points merely
because code and a draft deck exist.

| ID | Deduction | Specific reason |
|---|---:|---|
| R1 | Relevance -2 | No measured manual-versus-assisted coordinator workflow; saved travel and avoided cancellations remain hypotheses. |
| R2 | Relevance -1 | No measured cost per completed review or buyer-specific operating case. |
| R3 | Relevance -2 | No demonstrated deployment/adoption handoff covering identity integration, data mapping, operational ownership and judge-period availability. |
| T1 | Technical -3 | Web guard exists, but agent JSON instruction is not deployed; direct ASK/MCP still returns raw output; Class A artifact lacks the named referral required by its schema. |
| T2 | Technical -3 | Final-account policy, consent withdrawal and concurrent session isolation lack a complete positive-control-backed live suite. |
| T3 | Technical -4 | Dev/held-out sets share a patient and all seven layout labels; independent answer/citation/recall/leakage/latency measurements are absent. |
| T4 | Technical -2 | Authored skills, VQRs and task definitions lack complete invocation/result proof on the final release. |
| T5 | Technical -3 | Final hosted path has not demonstrated timeout recovery, interrupted writes, duplicate delivery, concurrency or latency limits. Local strict OCSP connection currently fails. |
| C1 | Completeness -5 | No independently verified judge-accessible hosted frontend/backend revision. |
| C2 | Completeness -3 | Update bundle assumes existing objects; clean-account installation and exact deployed revision are unproven. |
| C3 | Completeness -2 | No recorded final-build run of raw ingest through verified evidence, cited answer, human review and saved history. |
| C4 | Completeness -2 | Template deck remains a draft; measured impact, final links, disclosures and release manifest are not finalized. |
| C5 | Completeness -1 | Final recording and its accessible link are absent; intentionally scheduled last. |

Verified at this checkpoint: 418 Python tests passed, 14 skipped, 36 subtests passed;
267 web tests passed; TypeScript and production build passed. These are engineering
checks, not patient outcomes or end-to-end AI accuracy. See
[runtime evidence](../evidence/qa/ANSWER-BOUNDARY-2026-10-04.md).

## Phase 2 — Competitive wedge

These are architectural archetypes, not unsupported claims about named products.

| Standard approach | Failure to challenge | SAARTHI's concrete alternative |
|---|---|---|
| PDF chatbot with citations | A relevant citation can coexist with an unsupported statement, outdated evidence or conflicting records. | Typed claims, source clocks, independent extraction, exact spans and a post-generation validator; structured wording is reconstructed from SQL. |
| LLM over SQL and vector search | A prompt can select a different patient or generate a rule outcome; SQL correctness alone does not prove scope. | Bound server session, patient ID omitted from tool inputs, SQL-versioned gates, protected content fetch after retrieval. |
| Patient dashboard with summarization | Displays records but leaves reconciliation, follow-up and historical reconstruction to the operator. | Missingness states, table/letter comparison, historical cutoff, reviewed follow-up and persisted history. |

The first-minute proof should be a discrepancy, not a feature tour: display a SQL
fact, open its evidence, show a table/letter disagreement, then move the knowledge
cutoff and explain why the evidence available at that time differs.

The live validator already demonstrated one distinctive behavior: invented treatment
wording attached to valid PLT evidence became only "Recorded PLT: 82000 /cumm" plus
event time and provenance. This establishes a bounded mechanism, not universal
hallucination prevention.

The defensible asset is the combination of versioned domain rules, provenance,
failure cases and a usable reconciliation workflow. Snowflake services alone are
available to competitors. No measured 10x speed advantage exists yet.

Commercial positioning: begin with a day-care operations team; propose the operations
manager as buyer and coordinator as daily user. Measure review minutes and unresolved
items per completed case. Expansion to other care settings should reuse the evidence
contract and supply separately reviewed mappings and rules. These are adoption
hypotheses requiring a pilot, not signed customer demand.

Named adjacent submissions offer packaging lessons, as documented with pinned
file/line sources in [the earlier audit](SUBMISSION-READINESS-AUDIT-2026-10-04.md):
KASAUTI's evaluator path and artifacts; Verity's contaminated-evaluation disclosure
and replacement; ATLAS's deployment path. Do not claim those teams lack capabilities
simply because a README does not mention them.

## Phase 3 — Eliminate every deficit

| ID and deficit | Root cause | Action | Judge-facing acceptance proof |
|---|---|---|---|
| R1 -2 | Impact unmeasured | Counterbalance manual and assisted review of identical synthetic questions/records; record operator, order, time and answer correctness. | Absolute correct/total, median time in each arm, per-case observations and study limitations. No fabricated human baseline. |
| R2 -1 | Economics unspecified | Capture query/AI usage and task duration for a completed review; separate idle hosting from marginal review cost. | Dated cost worksheet and explicit volume/wage assumptions; no invented ROI. |
| R3 -2 | Adoption handoff incomplete | Document identity/consent source, field mapping, owner, retention and account funding through judging; exercise synthetic onboarding. | Named operating responsibilities, tested onboarding checklist and availability evidence. |
| T1 -3 | Incomplete answer boundary | Deploy claims-producing agent instruction; guard every advertised entry point; complete named-practitioner Class A contract. | Supported/unsupported/contradicted/error cases at actual endpoint; exact citation opens; SQL clock; zero raw rejected prose. |
| T2 -3 | Security checks stale/incomplete | Exercise known-existing foreign evidence with authorized control; revoke consent; alternate concurrent patient sessions. | Query IDs and absolute pass/fail counts for control, canary, cross-scope, revocation and session isolation. |
| T3 -4 | Contaminated evaluation and missing measurements | Build genuinely disjoint patient/layout sets, freeze hashes, keep gold answers outside app access, run final endpoint and adjudicate citations. | Correctness and supported-answer recall >=90%; citation precision >=95%; full evidence coverage; zero scope leaks; all designed missing/conflict cases correct; counts included. |
| T4 -2 | Definitions presented without execution | Run actual skill selection, seven VQR examples and one incremental processing cycle. | Invocation traces, result rows, query IDs; repeat ingest yields no duplicate assertions. |
| T5 -3 | Runtime failure behavior unproven | Verify strict TLS on host; test bounded timeout, dependency failure, lost write response and duplicate retry; measure concurrency. | Visible recoverable states, readback/idempotency proof, zero duplicate writes, sample count and warm p95 <=15s; cold starts separate. |
| C1 -5 | No usable hosted release | Deploy same frontend/backend revision with server-only, appropriately scoped credentials and controlled synthetic judge access. | Fresh browser completes documented workflow without local setup; tested URL and revision. |
| C2 -3 | Installer assumes populated account | Add required-object preflight and complete create/update ordering; run isolated installation without destructive update scripts. | Installation transcript, required-object inventory, source/deployed hashes and rollback procedure. |
| C3 -2 | Final loop not exercised | Ingest a synthetic document, parse, verify, reconcile, ask, inspect source, save reviewed follow-up and reopen history. | One continuous final-account trace connecting document, assertion, rule, answer and persisted action IDs. |
| C4 -2 | Draft packaging | Finish supplied template with problem, skill-connected architecture and actual impact; reconcile README, disclosures and release manifest. | Rendered deck, accessible assets, consistent metrics and licenses, one release revision. |
| C5 -1 | Recording absent | Record the verified 180-second path after release freeze. | Accessible video showing the same revision and clearly labeled recorded evidence. |

Execution order: T1/T2, then T3 with C1, then T4/T5/C2/C3, then measured impact and
final packaging. Gather timing/cost traces while testing. Record video last. No new
predictive model, dashboard rewrite or extra feature is needed to close these gates.

## Phase 4 — 180-second final demo

This is the target script. Rehearse every beat on the final deployment before using
it as a claim. Do not substitute fixture screens for live results without labeling.

| Seconds | Exact view/action | Spoken point and visible evidence |
|---|---|---|
| 0-15 | Day-care census, `/` | "Before a visit, a coordinator must reconcile reports, recorded values and authorization documents. Missing and contradictory records create follow-up work." |
| 15-30 | Open `/patient/PAT-DC-04` | "SAARTHI turns those records into a reviewable evidence state." Point at patient binding, missingness and known-as-of. State all patients are synthetic. |
| 30-45 | Open platelet rule/detail | Show 82,000, the SQL rule's threshold, rule ID and version. Say it is a record/rule check requiring practitioner review, not permission to treat. |
| 45-60 | Open exact source passage | Show the source page, highlighted span and clocks. "You can inspect the record behind the result." |
| 60-78 | `/patient/PAT-DC-07`, Coverage comparison | Show recorded `pending` versus letter `Approved`; the system exposes disagreement instead of silently selecting one. Recheck final-account values before recording. |
| 78-90 | Set cutoff before letter ingestion | Show the historical evidence set change; restore current cutoff. "This answers what was known then." |
| 90-105 | Prepare, review and save follow-up | Show human review and persisted receipt, then `/history/PAT-DC-07`. One intent must create one saved action. |
| 105-120 | Ask record question, then clinical question | Show validated citation, then refusal and evidence packet addressed to the actual treating practitioner. Never invent the practitioner's identity. |
| 120-140 | Existing SQL probe/result evidence | Show authorized positive control and cross-patient denial with query IDs. Do not invent a Judge Console UI; none exists. |
| 140-160 | Template architecture slide | Trace structured/PDF sources -> verification -> SQL rules -> scoped tools -> answer validator -> workflow. Identify actually invoked CoCo skills. |
| 160-180 | Impact/results slide and release links | Give measured review time, correctness/citation counts and latency; show hosted app/repo/revision. Close with the coordinator task completed. |

Preflight: warm the named warehouse without hiding cold-start measurements; check
the three sources and exact expected states; use stable synthetic fixtures; verify
write cleanup/reset before rehearsals; keep dated query outputs as a clearly labeled
fallback. A service outage is shown as an outage, never a simulated live answer.

### Three adversarial questions

**1. "Your citation is real. What stops the model attaching an invented conclusion?"**

The candidate never becomes the displayed web answer directly. It passes through the
bound-session validator and the frozen response contract. Structured wording is rebuilt
from database values. The live test replaced invented treatment wording with the
82000 /cumm record statement; a second call omitted all three invalid candidates.
Document entailment uses an AI check and still needs independent accuracy evaluation.
Direct ASK/MCP cannot be described as equally guarded until T1 is closed.

**2. "What if two users switch patients while consent is revoked?"**

Patient scope belongs to server-bound sessions, not question text. Tool schemas omit
patient ID; protected source fetch and consent checks enforce the boundary. Snowflake
Search uses owner's rights, so the index alone cannot be the authorization boundary.
The definitive release answer must include the positive control, parallel-session
test and mid-session revocation result. Those final-build results are not yet recorded.

**3. "Why would a hospital pay, and what did you actually measure?"**

The proposed buyer pays for reduced coordinator review work and traceable follow-up,
not an autonomous clinical opinion. Current proof is synthetic functionality and
engineering tests; no clinical outcomes or financial savings are measured. R1/R2 close
this gap with a paired workflow study and cost-per-review calculation. Present the
observed counts and timings, identify operator/order effects, and label pilot economics
as estimates. Do not call unit-test counts customer impact.

## Sources and decisions

Checked 4 October 2026:

- [Official event](https://hack2skill.com/event/cococlihack-gccedition/): PS-04 and
  rubric. High confidence; retain 30/40/30, no invented official subweights.
- [Cortex Search](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview):
  owner's-rights security implications. High confidence; require scoped protected fetch.
- [Agent skills](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-skills):
  platform capability does not establish execution on this account. Require invocation proof.
- Supplied six-slide PowerPoint template: requires a problem brief, architecture showing
  connected CoCo skills and measurable impact. Preserve these groups in final packaging.

Rejected: an unmeasured 10x claim, assigning clinical accuracy from synthetic fixtures,
counting definitions as runtime evidence, and replacing completion work with more features.
