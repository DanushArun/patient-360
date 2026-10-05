# SAARTHI submission readiness: evidence audit and path to 100

Prepared 4 October 2026, approximately 20:35 IST. Source snapshot inspected:
`a4bd6758f631ea34ef960080bf3ab582921b130f`. This audit reads code, recorded evidence,
official rules, and three freshly cloned public repositories. No Snowflake queries,
model calls, deployment, submission, or application tests were performed for this audit.
Recorded test results belong to their named QA runs. Synthetic engineering checks are
not clinical validation. Implementation changes after this snapshot need another review.

## 1. Target and current assessment

Target: satisfy every published criterion with a working artifact and inspectable proof.
The official weights are Relevance 30, Technical Execution 40, Completeness 30.
There are no published per-feature point allocations. The numbers below are an internal
prioritization model, not an organizer-issued grade or a measured accuracy result.

| Criterion | Current evidence score | What already earns credit | Evidence needed for full credit |
|---|---:|---|---|
| Relevance | 25/30 | Specific coordinator/family workflow; records, coverage, documents and versioned rules; clinical-judgment refusal | Demonstrate an unaided user completing a meaningful record-reconciliation workflow; source the problem and distinguish expected benefit from measured benefit |
| Technical Execution | 24/40 | SQL rules; independent model families; scoped procedures; platform findings; substantial offline verification | Final-build live scope/consent tests; guarded cited Q&A; independent evaluation; demonstrated skill invocation, VQR validation and task execution |
| Completeness | 17/30 | Source, detailed runbooks, judge walkthrough, status ledger, failure index and deck outline | Judge-accessible product; actual deck and recording; usable installation path; accurate final release manifest and completed portal sections |
| **Total** | **66/100** | Strong engineering foundation | **34 points in this model depend primarily on proof, access and the central Q&A path** |

The older `evidence/qa/JUDGE-EVALUATION.md` gave 59–75. Several of its missing-code
findings are now addressed in source (policy argument, VQR definitions, skill upload,
documentation), but their live outcomes are not established by those edits. Do not use
that older gap list unchanged. Likewise, 405 Python tests, 257 web unit tests and the
recorded Playwright runs are reports from other runs, not freshly observed here.

## 2. Official requirements and exact submission surface

The [GCC event page](https://hack2skill.com/event/cococlihack-gccedition/) confirms
PS-04: combine siloed records and documents into a patient/member 360 and answer with
cited evidence, using synthetic or de-identified data. It publishes the 30/40/30 weights.

The [linked official rules](https://docs.google.com/document/d/e/2PACX-1vTrXSK6v7T9tP3-Ab8LuFCDOuuW90debariK5I3PsIF0TrQ4A6q5RSC2B2wA4WM7Qif16AgynvdA4XL/pub)
confirm:

- Submission ends **4 October 2026 at 23:59 IST** (§1.1); the entry cannot change afterward (§4.1).
- A presentation deck and complete judge-accessible source are required (§4.5).
- Entries/presentations must be in English (§4.2).
- List datasets and link/copy applicable licenses for non-Snowflake datasets (§4.3b).
- Finals require a live demonstration; a recording substitute requires organizer approval (§4.5c).
- The published judging period is 5–22 October. It does not prove each judge spends 18 days on a repo.

The authenticated [submission portal](https://hack2skill.com/event/cococlihack-gccedition/dashboard/submissions)
was inspected visually in Arc. It has **two separate ongoing cards**:
`GitHub/Deployed Link` and `Prototype/MVP Submissions`, both with the same deadline.
At inspection it displayed 3h31m remaining. Neither expanded form's exact fields,
limits, template or save status has been inspected yet. Opening the prototype card
was rejected by automatic approval review because the coordinate click was not
verified as read-only; manual opening was requested. Nothing was submitted.

The user subsequently supplied the actual local template:
`/Users/danusharun/Downloads/CoCo CLI Hackathon Submission Template.pptx`.
Its six slide XML files were read directly. Slide 1 requires team name, problem
statement, team leader and team size. Slide 2 specifies three content groups:

| Required group | Exact content requested | SAARTHI content to supply |
|---|---|---|
| Problem Brief | Real business problem, target persona, current pain/improvement, domain context | Day-care coordinator reconciling fragmented clinical and coverage records before a visit; synthetic conflict example; distinguish coordination support from clinical judgment |
| Architecture Diagram | Data flow, which CoCo CLI skills connect, structured/unstructured sources, modular components | EHR/claims/FHIR and PDFs -> Snowflake pipeline -> independent extraction -> versioned SQL -> scoped tools -> guarded Q&A/UI; show actual skill deployment/invocation status |
| Impact Statement | Measurable outcomes such as time/accuracy improvement, scalability, extension beyond demo | Live measured task times, independent citation/answer results, absolute counts; clear scalability mechanism and measured limits |

Slides 3, 4 and 6 contain no extracted text; slide 5 is labeled `Additional Slide`.
This template makes **measurable impact and skill-connected architecture explicit**.
It is insufficient to replace the impact section with planned benefits or raw test counts.
After the template was supplied, a new Arc screenshot attempt failed with
`Sky Computer Use native pipe closed before response`; field limits remain unobserved.

`planning/PROBLEM-STATEMENT-verbatim.md:23` preserves the supplied lifecycle guidance:
CoCo planning, development, execution and testing evidence; reusable skills, automation,
MCP and custom tools are ingenuity signals. These have no published numeric bonus weights.
The explainer transcript at `planning/research/hackathon/ps-explainer-transcript.md:96`
explicitly mentions React as well as Streamlit. A last-minute UI rewrite is unnecessary.
The transcript is auto-captioned supporting evidence, weaker than written requirements.

## 3. Fresh competitive evidence and transferable actions

These are public-source observations at pinned commits, not independently tested
runtime claims or known winners. They cannot establish what all teams are building.

| Comparator | Source checked | Concrete submission advantage | Action for SAARTHI |
|---|---|---|---|
| KASAUTI, another GCC track | [README:12](https://github.com/apoorvgpt9/kasauti/blob/5930d050e459e5ba4c2d73b42175a9cfa5338651/README.md#L12), [README:19](https://github.com/apoorvgpt9/kasauti/blob/5930d050e459e5ba4c2d73b42175a9cfa5338651/README.md#L19), [Evaluation:17](https://github.com/apoorvgpt9/kasauti/blob/5930d050e459e5ba4c2d73b42175a9cfa5338651/docs/EVALUATION.md#L17) | Video, actual deck, evaluator login/path, separate invariant and AI measurements, including 0/3 and 1/3 results | Put working links at the README top; publish measurements with failures and denominators; provide expected results for each judge step |
| Verity, same PS-04 | [README:56](https://github.com/Favas111/verity-pa-copilot/blob/5bd7e1b3eca958e49069ac111ff816c957145ec8/README.md#L56), [README:203](https://github.com/Favas111/verity-pa-copilot/blob/5bd7e1b3eca958e49069ac111ff816c957145ec8/README.md#L203), [README:218](https://github.com/Favas111/verity-pa-copilot/blob/5bd7e1b3eca958e49069ac111ff816c957145ec8/README.md#L218) | Three named demonstration paths; records a contaminated evaluation and its blind replacement; reports latency and citation counts | Use three existing patients to prove distinct workflows; fix the held-out split; measure source correctness instead of counting citations alone |
| ATLAS, same PS-04 | [README:20](https://github.com/casafurix/bodhix-snowflake-cococli-hackathon/blob/6aee2a6f2e58804d065b0c42f32c0df9f64fd748/README.md#L20), [README:28](https://github.com/casafurix/bodhix-snowflake-cococli-hackathon/blob/6aee2a6f2e58804d065b0c42f32c0df9f64fd748/README.md#L28) | Public app URL, deployment runbook, CI and three skill files | Deliver a judge-accessible URL and a verified operator path. Attempt to open its public URL returned a web-tool internal error here; uptime remains unverified |

SAARTHI's strongest story is the visible handling of missing, conflicting and superseded
records with SQL-derived outcomes and provenance. The policy/Cortex findings support
that story. Lead the demonstration with the user problem; show platform detail after
the product establishes its value. Avoid market-wide uniqueness claims.

## 4. Findings that change the release priorities

### A. The central Q&A path has no answer validation

`backend/sql/agent/ask_saarthi.sql` calls `DATA_AGENT_RUN` and returns its raw JSON.
`web/lib/patient.ts:341` calls it, parses response text and records answer pointers.
Neither this path nor the MCP path calls `VALIDATE_ANSWER`. Having the validator's
SQL file in the repo does not establish that user-visible prose was validated.

**Close:** produce the existing frozen claims contract, validate it on the same bound
Snowflake session, and render only accepted claims/facts. Numbers, dates, gates and
states must remain SQL-derived. On validation failure show an evidence-state limitation.
Apply the same rule to every answer entry point claimed as guarded. Test a supported
claim, an unsupported claim, a contradicted claim and validation failure on the live build.
An evidence viewer can demonstrate provenance, but does not replace the brief's Q&A experience.

### B. Refusals lose the required answer clock

`web/lib/question-routing.mjs:26` returns `known_as_of: null` for Class A refusals
(both artifact and outer response); classification errors also return null. This is
in tension with R2's every-answer requirement.

**Close:** carry the SQL-supplied snapshot time through the refusal/error contract;
do not invent a model-generated clock. Confirm stored history and displayed answers
agree on the timestamp. Define failure behavior when a SQL clock cannot be obtained.

### C. The current held-out split is not independent

A direct JSONL count found:

- Dev: 40 questions, 37 for `PAT-DEEP-0001`, 3 with no patient selector.
- Held out: 40 questions, 35 for `PAT-DEEP-0001`, 5 with no patient selector.
- Both files share the same seven layout labels: `cbc`, `general`, `guideline_ncd`,
  `guideline_who`, `imaging`, `pathology`, `scheme_pmjay`.

This does not satisfy SPEC §14's split by patient and document layout. No model
evaluation has been run, so the split can still be corrected and frozen before scoring.
Use existing synthetic patients and genuinely disjoint patient-document layouts;
renaming a label alone is insufficient. Keep the answer key inaccessible to the app/model.

`backend/eval/harness/score_results.py` scores class/outcome only. It does not measure
citation precision, evidence coverage, supported-answer recall, leakage or latency.
Its Class A expected count is incremented only after finding a result; incomplete runs
need a full-set expected denominator to avoid overstating refusal coverage.

**Close:** add/run the in-SPEC live evaluation runner, capture raw responses, query IDs,
timings and adjudicated citations, and score the full denominator. Separate development
from final held-out results and preserve failures. Use a plain-RAG baseline with the
same data/scope and frozen questions; never relax patient scope for the comparison.

### D. Source fixes and optional deployment skips are not demonstrated capability

The current policy argument is `p_doc_id`, with both joins qualified, and the deploy
bundle has a canary. The name-binding fix is in source; the final live negative result
still needs recording. The semantic view now has seven VQR definitions and the agent
has four stage skills; the older reports describing them as absent are stale.

`backend/scripts/build_deploy_bundle.py:125` catches semantic-view creation errors
and reports `skipped`; the README accepts readable skips for this and agent/MCP grants.
The bundle **does not create SAARTHI_AGENT or SAARTHI_MCP**, and assumes several
pipeline/entry procedures already exist. This is an account-update bundle, not a
self-contained clean-account installer. `setup.sql` is excluded because core-table
creation can drop data; do not use it to update the populated submission account.

**Close:** inspect required-object presence and definitions before applying updates.
Treat skipped objects as missing proof for any claim depending on them. Capture VQR
creation plus question/result validation, actual skill selection/invocation, and the
final account's agent/tool/grant behavior. [Snowflake's skills documentation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-skills)
supports top-level stage skills, so source uncertainty alone is no reason to delete
the block. Account-specific behavior and uploads still require live checks.

### E. Hosting needs more than a build

The current product is localhost with one operator identity. `web/lib/snowflake-config.mjs:22`
requires a server-side PAT/key **file path**; hosting needs secure file mounting or a
reviewed configuration adaptation. The recorded PAT policy restricts login to the
workstation IP. A new host's egress may therefore be rejected before any SQL runs.

**Close:** choose a Node-capable host, verify its secret-file mechanism and Snowflake
network compatibility, deploy the production build, then test from a second browser.
Provide controlled judge access to synthetic records and bound writes; keep credentials
server-side. A shared demonstration identity is not per-practitioner authentication.
Budget/account lifetime must cover judging; the earlier screenshot says trial ends in
8 days, shorter than the published evaluation window. Recheck the actual account's expiry.

### F. Submission artifacts and data disclosures remain incomplete

The repo contains a deck outline, not the deck or video. `docs/DATASET-LICENCES.md`
lists unresolved reference-document rights and a real-person research note in the
submitted tree. The rules cover the whole entry, not only rows loaded into Snowflake.

**Close:** export an actual English deck; record the verified live workflow; resolve
source/license links for used references; prepare a sanitized submitted tree preserving
format research and eliminating identifying health details. Check the Git history and
public release contents where applicable rather than treating a current-file edit as
historical removal. Keep public accessibility and reuse rights distinct.

## 5. Release gates for a full-credit technical submission

These gates implement existing SPEC features. They do not authorize new product scope.

| Gate | Required proof |
|---|---|
| One complete cited Q&A flow | Document -> parse -> independent verification -> SQL rule -> question -> validated answer -> highlighted exact source, same final account/build |
| Scope and consent | Authorized positive control; DOC_PAGE canary hidden; cross-patient tool denial; direct patient table/Search denial as app role; immediate denial after consent revocation; no cross-session patient bleed |
| Missingness and time | Missing is distinct from negative; conflicting input is not evaluated; changing `known_as_of` before ingestion hides later evidence; answer/refusal clocks are populated consistently |
| R7 | Actual two-family outputs plus the recorded pass-B failure; a controlled disagreement fixture through reconciliation/gates, explicitly labeled controlled. An ambiguous page may yield agreement and cannot guarantee a natural disagreement |
| Evaluation | SPEC targets: 0 cross-scope leaks; 100% evidence coverage; citation precision >=95%; held-out correctness >=90%; all designed missing/conflict cases correct; supported-answer recall >=90%; warm p95 <=15s. Report counts and cold starts separately |
| Native execution | VQR questions checked against actual results; skill invoked with one reuse and one refused ambiguity; one observed incremental task cycle with dedupe; current-account agent/MCP tested if claimed |
| Judge access | Hosted URL opens in a fresh browser with documented access; no localhost/key path required from the judge; expected steps are usable |
| Reproduction | Existing-account update is repeatable and clean-account installation is separately rehearsed on a disposable target if claimed; never drop the active account to rehearse |
| Package | Deck, demo, source, dataset terms, status ledger and both portal sections complete; links verified; final source revision identified; receipt/status saved |

## 6. Execution order before the deadline

Use the remaining window for separate code/deployment and package work, with an early
submission checkpoint. This is a sequence of acceptance milestones, not a promise that
unknown live failures take a fixed number of minutes.

1. **Now:** inspect both expanded portal sections and download/read the required
   template. Choose hosting and preserve the required field/file-limit checklist.
   Begin the deck from the existing outline; resolve data disclosures immediately.
2. **Core handoff:** the coding agent closes the guarded Q&A contract, clock propagation
   and evaluation split/runner. Identify the final source snapshot and run its required checks.
3. **Deploy and prove:** confirm account identity; apply bounded account updates; verify
   policy before exposure; check required agent/procedure definitions; run one cited
   question, one refusal, source conflict, cutoff replay and scope denial. Record query IDs.
4. **Host and measure:** deploy the same web snapshot; run the evaluation against that
   backend; verify fresh-browser access and history read-back. Run skill/VQR/task proofs.
5. **Package:** export deck, record the demonstration from verified outcomes, put links
   at the README top, update the ledger from actual results, and verify licenses/access.
6. **By 23:00 IST:** make the entry complete in both portal sections and verify their
   visible status/receipt. Reserve the last hour for corrections and link/upload failures.
   Any final agreement acceptance/submission must follow the applicable confirmation rules.

Do not consume the release window rebuilding Streamlit, expanding from 12 to 100
patients, adding a Judge Console UI, or inventing predictive models. Twelve varied
cases with independent measurements are better evidence than a larger unverified count.
External MCP action is an optional ingenuity signal; protect the cited Q&A and complete
submission first. A temporary laptop tunnel needs an explicit uptime plan and should
not be presented as durable deployment.

## 7. Demonstration and deck

Use three existing synthetic patients after checking their live values:

1. **PAT-DC-04:** a SQL-derived missing/failed record check -> exact evidence passage.
2. **PAT-DC-07:** table/letter conflict -> cutoff replay -> reviewed follow-up -> persisted
   history. Show the difference between evidence state and practitioner judgment.
3. **PAT-DC-01 or PAT-DEEP-0001:** an evidence-backed record answer, followed by a Class A
   refusal and a practitioner-addressed packet. Choose whichever verifies on release day.

Suggested 3-minute order: user problem (15s); cited Q&A (45s); conflict and time replay
(45s); refusal and follow-up (35s); scope proof and measured results (25s); judge path (15s).
Warm the demo separately and report its cold-start timing. Never label a fixture as live.

Use the supplied template's design and required content: title/team; problem/persona;
architecture with connected skills and data sources; measured impact/scalability;
evidence and CoCo lifecycle; judge links and explicit limits. Add demonstration screenshots
if the portal permits additional slides. Do not leave instructional placeholder text in
the submitted deck. Show observed coordination time or workflow completion only if actually measured.
Cancellation reduction, travel savings and clinical benefit remain hypotheses until measured.

For the requested impact statement, use a small transparent synthetic-task study:
three existing cases, the same record questions and inputs, a timed manual record review
followed by the app-assisted workflow, with the operator and run order recorded. Report
all task times and correctness, and disclose order/familiarity bias. Label it a small
synthetic usability benchmark, not a demonstrated hospital saving. Separately measure
the frozen held-out answer/citation set. Do not present model agreement or 66/66 links
from generated documents as independent extraction accuracy.

## 8. Copyable handoff to the coding agent

> Prioritize the existing SPEC's guarded cited-answer path before extra features.
> ASK_SAARTHI and the MCP path currently bypass VALIDATE_ANSWER; the web renderer uses
> returned agent prose. Produce the frozen claims contract and show only validated
> claims, deriving every status/value/time from scoped SQL. Carry SQL known_as_of into
> refusals (currently null). Repair/freeze the dev/held-out split: both presently use
> PAT-DEEP-0001 and all seven layout families. Add a live run/result capture path and
> metrics beyond class/outcome. The deploy bundle omits agent/MCP creation and several
> required procedures; make the final account's required-object checks explicit and
> distinguish semantic/grant skips from successful capability verification. Deliver
> the exact release revision, required check results and a list of live gates left open.

## 9. Audit limitations and retained failures

No fresh Snowflake or model behavior was verified here. Public competitor runtimes,
video playback and private evaluator accounts were not tested. The ATLAS URL lookup
returned an internal web error. The first JSONL-overlap counting script tried to sort
`None` alongside strings and failed after printing the counts; it was corrected with
`key=str`, producing the overlap listed above. Automatic approval review blocked
opening the portal card; expanded fields remain pending manual navigation.

No code, credentials, git index/history or external submission was changed by this
audit. This document is the only new repository artifact from the audit.
