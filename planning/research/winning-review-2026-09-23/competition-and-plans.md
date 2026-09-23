# Competition requirements and planning audit

Reviewed 23 September 2026. Read-only audit of existing implementation; this report changes no code.

SAARTHI has a credible problem and a detailed design. Its strongest competition strategy is to prove
one useful, governed workflow completely, make that proof easy to reproduce, and describe its limits
accurately. Additional architectural breadth has lower value until that workflow is real.

## Evidence and scope

- Reviewed the root README/status ledger, planning and builder plans, revised architecture,
  historical reviews, decision records, hackathon research, and CoCo evidence directory.
- Rechecked the [official event page][event], including the PS04 details modal in a browser.
- Read the published **Snowflake CoCo CLI GCC TnCs**, reached through the event page's
  **Terms and Conditions** link. Sections below identify the relevant provisions.
- Reviewed the existing [explainer findings][explainer]. Its transcript uses automatic captions;
  speaker recommendations are weaker evidence than the current official written requirements.
- This review did not run the Snowflake deployment or verify the current account inventory.
  Statements about existing implementation below are document contradictions or local file checks.

[event]: https://hack2skill.com/event/cococlihack-gccedition/
[explainer]: ../hackathon/explainer-session-findings.md
[brief]: ../../PROBLEM-STATEMENT-verbatim.md
[spec]: ../../revised-architecture/SPEC.md
[winning]: ../../WINNING-PLAN.md
[work]: ../../WORK-PLAN.md
[handoff]: ../../revised-architecture/ARCHITECTURE-HANDOFF.md
[copilot]: ../../revised-architecture/COPILOT-SPEC.md
[validation]: ../../revised-architecture/FINAL-VALIDATION.md
[household]: ../../revised-architecture/DECISION-household-removal.md
[status]: ../../../IMPLEMENTATION-STATUS.md
[readme]: ../../../README.md
[evidence]: ../../../evidence/coco/README.md
[trace]: ../../builder-1/TRACEABILITY.md
[build]: ../../builder-1/BUILD-PLAN.md

## Rules that change the execution plan

The [official event page][event] currently confirms:

- Submission closes **4 October 2026**; evaluation is **5–22 October**.
- Shortlist: **23 October**; induction: **26 October**; finale: **27–30 October**.
- Published rubric: relevance **30%**, technical execution **40%**, completeness **30%**.
- The **$10,000 is the prize pool**. First prize is **$4,300**, displayed as **₹4 lakh**.

The linked official T&Cs add requirements missing from the main plans:

- **§1.1:** deadline is **11:59 PM IST** on 4 October.
- **§4.1:** the submitted Entry cannot change after the submission period ends.
- **§4.2:** submissions and oral presentations must be in English.
- **§4.3(b):** identify every dataset and provide licenses for non-Snowflake datasets.
- **§4.5:** submit a deck and accessible full source; finalists must demonstrate live.
  A recording needs explicit organizer approval to substitute for the live demonstration.
- **§4.6:** a new finalist trial account is possible, not promised.
- **§9:** Snowflake use and Python, Java, or Scala are specified; platform features receive
  consideration, but detailed scoring remains discretionary.

Treat 4 October as a frozen release. Stage 2 is presentation and reproducible deployment of that
entry, unless the organizer explicitly permits further changes. The split in [SPEC][spec] lines
863–865 describes different presentation needs; it must not become permission to finish features
after submission. Package the Judge Console, security probes, and correction replay before the freeze.

The published rules offer a prize and exposure, not guaranteed startup investment or adoption.
Winning can help this mission; a usable prototype and pilot evidence retain value independently.

The event page advertises India GCC eligibility while the linked T&Cs list broader territories.
[WINNING-PLAN][winning] line 17 already records eligibility and registration confirmed by Danush.
Keep that confirmation with the submission rather than reopening a resolved question from inference.

## Mandatory requirements versus optional signals

The current PS04 modal supports these core obligations:

1. Patient **or** member 360, using synthetic or de-identified data.
2. Combine structured records and unstructured documents.
3. A question-and-answer experience with source evidence; no opaque predictions.
4. CoCo evidence across planning, development, execution, and testing.

It recommends semantic views, ontology, verified queries, pipelines, and app/document workflows.
Reusable skills are the named headline bonus. MCP, scheduled work, custom tools, orchestration,
additional surfaces, and graceful fallback are ingenuity examples. No published bonus weights
were found. Source: [official PS04 details][event], rechecked 23 September.

**Internal choices, not organizer requirements:** 34 tables, 16 rules, six screens, 100 patients,
four skills, 80 questions, a particular Task topology, four translation languages, and a live
outbound MCP action. They can be worthwhile, but none should be described as individually mandatory.

The [verbatim brief analysis][brief] lines 102–113 promoted MCP to committed scope because it appears
twice. That is an internal prioritization decision. The [explainer][explainer] lines 86–90 even records
the presenter allowing teams to skip it. Existing commitments should be completed after the core is
proven; counting repeated mentions does not justify missing the core.

Similarly, [explainer][explainer] lines 35–54 infer four skills from examples of separate processes.
The official modal allows coordination of agents **or skills**; it does not require precisely four.
Prove that useful reusable instructions actually execute, with handoffs and a second-schema test.
Four empty files or a Task whose name says orchestrator do not demonstrate that capability.

## Corrections to the plans

### 1. Put the functioning workflow first

[WINNING-PLAN][winning] lines 40–47 and [HANDOFF][handoff] lines 36–44 put the deployed vertical slice
fifth, after extraction, consent, identity, and skills. Those controls belong inside the slice.
They are not separately winning assets if the user cannot complete a question-to-evidence workflow.

The same plans have the right hard gate: [WORK-PLAN][work] lines 52–56 require one patient flowing
from document through verified extraction, rule evaluation, and a clickable citation under real
scope. That should be the first priority and daily acceptance test.

The schedule started on 17 September and used Day 5 as the cutoff. On 23 September, that checkpoint
has passed. If the live slice is still incomplete, apply the planned scope cut now. Do not silently
restart the seventeen-day schedule from the latest document revision.

### 2. The status ledger is not currently reliable enough for judges

[IMPLEMENTATION-STATUS][status] says:

- Lines 15–25: updated 20 September, scaffold only, nothing deployed through setup.
- Lines 145–154: four fixture-driven screens; backend tools exist and are live.
- Lines 190–208: zero product procedures, roles, policies, tasks, semantic views, and skills.
- Lines 76–78: heading says 34 built; following text says all designed-only.

These cannot all be the current truth. They show update drift, not proof that nothing exists.
Regenerate the ledger from a dated deployment/test manifest and reconcile local, fixture-tested,
account-deployed, and clean-account-reproduced states. The current definition of built at line 9
requires deployment and clean-account reproduction, yet lines 35–37 call local contracts built.

The [README][readme] contains no quick-start or executable judge route; it directs readers into a
large architecture corpus. Put the running path, supported questions, evidence, setup, and limits
before architecture. A judge should see the product before learning the table inventory.

### 3. Historical reviews must remain clearly historical

[FINAL-VALIDATION][validation] line 10 declares no unresolved contradictions, while lines 20, 95,
and 175 still claim HOUSEHOLD/floater support. [The removal decision][household] lines 91–102
deliberately preserves that review as a snapshot. Preserve it, but label the snapshot prominently
and point readers at the later decision. It is currently linked from README as proof against the brief.

The current specification explicitly selects a one-database hackathon implementation and synthetic
consent artifacts: [SPEC][spec] lines 873–879. [WINNING-PLAN][winning] line 32 describes federated
source fetch and consent-lifetime caching as if that were the deployed implementation. The submission
must separate demonstrated local enforcement from future ABDM federation.

The two-builder plan in [WORK-PLAN][work] lines 3 and 24–27 supersedes the three-track assignments
in [WINNING-PLAN][winning] lines 79–83. Name one current owner for each remaining release gate.
Conflicting ownership charts are an execution risk even when each document is individually sensible.

### 4. Correct the benchmark denominator and deployment pointer

[SPEC][spec] line 844 specifies **80 total questions: 40 development and 40 held out**.
[IMPLEMENTATION-STATUS][status] line 225 says **80 development plus 80 held out**.
The 80 rule assertions at [SPEC][spec] line 851 are a third, different dataset.
Keep question counts, rule-case counts, patient splits, layout splits, and test-run counts separate.

[SPEC][spec] line 841 still points at `src/sql/setup.sql`, although the current deployment guide
and repository use `backend/sql/setup.sql`. A broken quick-start is a completeness defect, even
when the correct path exists elsewhere. Test copied commands on an empty account.

### 5. Rewrite clinical-readiness language and the first demo question

[README][readme] line 3 promises whether someone is ready clinically. [WINNING-PLAN][winning]
line 128 opens with whether a patient can resume chemotherapy. Yet [BUILD-PLAN][build] lines 78–82
correctly default ambiguous readiness questions to Class A refusal.

Use a precise operational question first: **What records and authorizations are missing for the
scheduled visit, and which sources disagree?** Show clinical judgment refusal as a separate beat.
Do not start the central product demonstration with a question its own classifier must refuse.

Frame the product as helping the care team reconcile records and prepare visits. A documented
threshold comparison must not be presented as treatment clearance. This is also a usability issue:
the user should understand exactly what action the evidence enables.

### 6. Stop declaring universal competitive superiority

[WINNING-PLAN][winning] lines 42–44 claims no competitor verifies extraction or models consent and
that every competitor has cosmetic access control. [FINAL-VALIDATION][validation] lines 124–136
compares designed SAARTHI capabilities with other repositories' implementation claims.

These are dated observations about a small surveyed set, not defensible market-wide facts.
For every comparison record repository, commit/date, file/line, positive observed behavior, and
the test performed. Absence from a reviewed code path does not prove a product lacks a capability.
Do not say SAARTHI leads on a capability until its deployed implementation passes the same test.

Lead the deck with what SAARTHI demonstrably does for a coordinator. Keep competitor weaknesses
as supporting research, not the emotional or technical center of the pitch.

### 7. Avoid certainty unsupported by the rules

The repeated claim that judges spend eighteen days alone with this repository is an interpretation
of the evaluation window, not a verified per-entry review duration. Self-service reproducibility
remains an excellent strategy, particularly if judges spend only a few minutes initially.

[FINAL-VALIDATION][validation] lines 221–232 declares design complete and further research
unnecessary. That dated conclusion cannot establish today's safety, completeness, or rule compliance.
Use short, dated evidence statements rather than another blanket validation verdict.

## Local deliverable gaps observed

The following were directly checked in the local working tree on 23 September:

- `data/reference/` is absent. [SPEC][spec] line 580 calls it a hard dependency; the regulatory
  demo cannot be claimed complete without accessible source documents and citation resolution.
- `backend/eval/` has no visible files. The evaluation claims remain targets pending results.
- `evidence/coco/` contains README, planning YAML, raw session CSV, and verification query IDs.
  There are no development, execution, or testing YAML manifests under those names.
- [CoCo evidence README][evidence] lines 25–28 names those missing manifests and calls development
  in progress. [Status][status] lines 237–239 instead says development has not started.
- A repository filename search found no submission deck, dataset-license inventory, or
  model-risk register. That is a scoped search result, not proof no equivalent exists elsewhere.

CoCo evidence must reflect actual CoCo use. This Codex audit should not be relabeled as a CoCo
session. Link genuine session records to generated artifacts, runs, query IDs, and failure/fix pairs.
Use honest provenance when multiple tools contributed to a file.

The license inventory should distinguish the synthetic generator and generated examples from
reference PDFs, standards, labels, research excerpts, and other third-party materials. A public URL
does not establish redistribution rights. Where rights do not permit bundling, document an allowed
retrieval path and still satisfy the judge's source-evidence workflow.

## Release priorities and acceptance evidence

### P0: one coherent, repeatable patient workflow

Own this as a single integration outcome, with the existing plans as implementation detail:

1. Sign in as a real allowed user, select a synthetic patient, and record the fixed test clock.
2. Ingest a source document and a structured record through actual supported pipelines.
3. Run two-family extraction and deterministic rule evaluation; preserve missingness and clocks.
4. Ask an operational question and click its evidence to the source row or page.
5. Ingest a correction, observe the new answer, then reproduce the older knowledge state.
6. Revoke consent and attempt access as an unauthorized user; both paths must block appropriately.
7. Submit a clinical judgment question and show the bounded refusal and practitioner packet.

Store the exact release commit, dataset seed/hash, source hashes, model/prompt/rule versions,
question/answer artifacts, query IDs, and expected results. A screen recording supports the proof;
it does not replace a re-runnable test or the required live finale.

### P1: demonstrate performance and usefulness, not just safe refusal

Run the documented held-out split once it is isolated by patient and document layout. Compare the
same cases against the baseline. Report supported-answer recall alongside correctness, abstentions,
citation validity, leakage attempts, latency, and cost; include counts and cold starts.

For extraction, break results down by source quality and error class. Agreement between two models
does not itself prove the source value is right. Include shared OCR errors, units, decimal/comma
traps, specimen conflicts, and unreadable cases against independently known synthetic ground truth.

For product relevance, measure a coordinator task: correct gaps identified, source-checking time,
incorrect assertions, and completed actions. Do not claim avoided travel, better cancer outcomes,
or population-scale benefit from synthetic engineering tests.

### P2: make the submission self-service

Provide one short judge entry path containing:

- The exact user, problem, and implemented workflow.
- An English deck and a short walkthrough with an unambiguous synthetic-data notice.
- One tested setup command, required privileges, account/region limitations, and cost estimate.
- A resettable synthetic scenario and a small list of questions to try.
- The result summary, full machine-readable evidence, and clear rerun commands.
- A current capability ledger and third-party dataset/license inventory.
- CoCo evidence organized by all four lifecycle phases, including failures and fixes.

The deployed demonstration should survive account expiry or be recreatable from the frozen entry.
Budget for the evaluation period and finale; a historical remaining-credit screenshot is not a
runtime availability plan. Preserve reproducible evidence beyond the originating trial account.

### P3: earn bonuses with bounded working examples

Once P0–P2 pass, demonstrate a reusable skill on a second synthetic schema, including one ambiguity
it refuses. Then complete the smallest useful existing MCP/notification action with idempotency and
review. Multi-surface evidence should reuse the same governed workflow and show the same boundary.

Do not add a new specialty, model, integration, or large corpus to improve a feature count.
Anything not ready at freeze is explicitly outside the demonstrated submission.

## Suggested six-minute narrative

This is a rehearsal format; the organizer has not confirmed a six-minute presentation limit.

| Time | Demonstration | What the judge learns |
|---|---|---|
| 0:00–0:40 | One family crossing facilities; introduce the coordinator | Specific, credible problem |
| 0:40–1:40 | Ask what is missing; click a row and document citation | Useful patient 360 and Q&A |
| 1:40–2:30 | A conflicting extraction stays unasserted | Evidence discipline is visible |
| 2:30–3:15 | Addendum changes the answer; replay the older cutoff | Correct handling of late data |
| 3:15–4:00 | Consent revocation and cross-user block | Governance works beyond a picker |
| 4:00–4:40 | Clinical question refused; show practitioner evidence | Clear responsibility boundary |
| 4:40–5:20 | Coordinator action or reviewed bring-list | Workflow closes into useful work |
| 5:20–6:00 | Test counts, cost, limitations, CoCo proof, next pilot | Honest, complete engineering |

Use the teammate's experience only with the family's permission and dignity. The demonstration
patient remains synthetic. The story explains why the workflow matters; the working system and
measured evidence establish why judges should trust this team to continue.

## Decision

Freeze the scope around operational care preparation, governed evidence, correction history, and
reproducibility. Retain the larger architecture as the roadmap. The next win is a stranger being
able to run the system, ask a new supported question, check its source, and observe the promised
failure behavior without a teammate explaining away a gap.
