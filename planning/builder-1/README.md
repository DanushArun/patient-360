# Builder 1 — handoff pack

**Stream 1: copilot, agent, tools, extraction pipeline, validator, skills, eval, Streamlit UI.**

Three documents. Read them in this order, after the 90 minutes of architecture reading listed at the top of `BUILD-PLAN.md`.

| Document | What it answers |
|---|---|
| [`REPO-STRUCTURE.md`](REPO-STRUCTURE.md) | Where every file goes, who owns which directory, and why `setup.sql` contains no DDL |
| [`AGENT-DEV-PLAN.md`](AGENT-DEV-PLAN.md) | The copilot's six components, their interfaces, the frozen answer schema ready to paste, and seven open questions already decided |
| [`BUILD-PLAN.md`](BUILD-PLAN.md) | Day 1 to Day 17: files, definition of done, acceptance test, and what to stub when Builder 2's half does not exist yet |
| [`TRACEABILITY.md`](TRACEABILITY.md) | Every requirement Builder 1 is accountable for → the file that implements it → the thing that proves it |

These are derived from `WORK-PLAN.md`, `COPILOT-SPEC.md`, `ARCHITECTURE-HANDOFF.md`, `AI-INTEGRATION-ARCHITECTURE.md`, `SPEC.md` and `ARCHITECTURE-DIAGRAMS.md`. **They add no scope.** Where the source documents contradict each other, the contradiction is listed below rather than quietly resolved — except the seven in `AGENT-DEV-PLAN.md` §11, which are Builder 1's own to call.

---

## The split, in one table

| | Builder 1 | Builder 2 |
|---|---|---|
| **SQL** | `procedures/tools/` · `classify_question` · `validate_answer` · `tasks/extract_assertions` · `tasks/reconcile_evidence` · `tasks/orchestrator` · `agent/` · `prompts/` · `stubs/` | `account/` · `tables/` · `governance/` · `data/` · `streams/` · `dynamic_tables/` · `search/` · `semantic/` · `integrations/` · `evaluate_gates` · `bind_patient` · the other four tasks · `setup.sql` |
| **Python** | `frontend/` · `backend/eval/` | `data/generator/` |
| **Other** | `backend/skills/` · `backend/tests/backend/sql/{access,extraction,validator}` · README | `data/reference/` · `backend/tests/backend/sql/rules` |
| **Contracts owned** | Answer JSON (3) · tool signatures (2) | Physical schema (1) · rule definitions (4) · synthetic data (5) |

---

## What is already on disk

The scaffold is built. Directories exist, the frozen contracts are written and verified, and the mechanical gate checks run.

| Path | State |
|---|---|
| `backend/sql/` … `frontend/` … `backend/skills/` … `backend/eval/` … `backend/tests/` … `backend/scripts/` | full tree, per `REPO-STRUCTURE.md` |
| `frontend/contracts/` | **written and verified** — schema, error envelope, tool signatures, plus a README explaining each constraint |
| `frontend/fixtures/` | 3 answer fixtures + 3 page fixtures. Every char offset was **generated from the page text**, so click-through lands where it should |
| `backend/sql/setup.sql` | the 21-step manifest, every line present and commented. Uncomment a line as its file lands. |
| `backend/sql/procedures/tools/_preamble.sql` | the bind → authorise → consent block, ready to paste. **Not yet compiled — no tables exist.** |
| `backend/sql/prompts/` | pass A lab + pass B verbatim from the spec; four type-specific drafts; `CHANGELOG.md` |
| `backend/skills/` | 4 `SKILL.md` scaffolds with correct frontmatter, README carrying the three silent gotchas |
| `backend/tests/TEST-MANIFEST.md` | every required test named — 14 access, 10 extraction, 8 validator, 4 classifier, 8 probes |
| `backend/scripts/check_gate.py` | 5 mechanical checks. **Verified to catch injected violations, not just to pass.** |
| `backend/scripts/deploy.sh` | parses the manifest, runs each step, resumes from a failure. Dry-run tested. |

```sh
backend/scripts/check_gate.py --all            # 13 pass, 3 skip (agent, tools, manifest not written yet)
backend/scripts/deploy.sh <connection> --dry-run
```

`--strict` turns every skip into a failure. Use it from the Day-5 gate onward.

---

## Day 1, in order

1. **Settle the six items below with Builder 2.** Twenty minutes now, or a rewrite on Day 6.
2. **Review and commit the contracts.** They are written; they are not yet agreed. Item 7 needs your decision specifically.
3. **Build the whole Ask + Evidence screen against `frontend/fixtures/`.** No table needs to exist.
4. **Run U2, U3, U4** and record the query IDs in `evidence/coco/verification-query-ids.md`.

---

## Seven things to settle before writing code

**Six are places the source documents contradict each other; the seventh is an extension made while writing the contracts.** All seven block Builder 1. Recommended resolutions are given because a recommendation is faster to reject than a blank to fill.

### 1 — Who writes the tool procedure bodies

`WORK-PLAN.md` line 34 (frozen contracts) says *"Stream 1 specifies, Stream 2 implements bodies."* `WORK-PLAN.md` Days 3–4 puts `backend/sql/procedures/tools/*.sql` squarely in Stream 1's task list. `ARCHITECTURE-HANDOFF.md` §2 says the reverse of both (*"Stream B specifies, Stream A implements the bodies"*) using the older three-stream lettering.

**Recommended: Builder 1 writes them.** The day-by-day plan is the more operational document, the tool layer is the trust boundary the copilot depends on, and the person building the agent should own the surface the agent calls. Builder 2 owns the tables those bodies read and reviews the preamble.

**Cost of getting this wrong: three days.** It is the single most expensive ambiguity in the plan.

### 2 — Who writes `bind_patient`

Builder 2's Day 2–3 governance task lists it; Builder 1's Day 6–7 tool list lists it as tool 9.

**Recommended: Builder 2 writes it on Day 2–3** — it is pure governance, it validates `CARE_TEAM` and `CONSENT`, and Builder 1's Day-1 UI needs it to exist early. Builder 1 owns its negative tests and the patient-picker integration.

### 3 — Operational table names

`ARCHITECTURE-HANDOFF.md` Contract 1 names `RULE`, `READINESS_STATE`, `REVIEW_TASK`. `SPEC.md` §2.8 names `RULE_CATALOG`, `REVIEW_ISSUE`, `TASK`. Builder 1's tools, validator and UI all read these.

**Recommended: Contract 1 wins** — it is the frozen contract and it is what `WORK-PLAN.md` step 6 counts. `SPEC.md` §2.8 gets a correction note.

### 4 — `EVIDENCE_PACKET` is missing from Contract 1

It is in `SPEC.md` §2.8 and it is the actual output of the Class A refusal path — the most safety-critical path in the system, and the one `COPILOT-SPEC.md` §4 promises in the UI. Contract 1's table list omits it.

**Recommended: add it to `OPERATIONAL`.** Without it, the Class A refusal has nothing to hand the named practitioner, and *"I can assemble the evidence they would need"* becomes a claim with no object behind it.

### 5 — Role names

`WORK-PLAN.md` Day 1 step 4 creates `SAARTHI_NAVIGATOR`. `AI-INTEGRATION-ARCHITECTURE.md` §10 lists `SAARTHI_FAMILY`. The UI checks role to decide whether `create_review_task` is offered, so Builder 1 hard-codes whichever name wins.

**Recommended: `SAARTHI_NAVIGATOR`** — it matches `CARE_TEAM.role_type = 'patient_navigator'` and the Navigator View screen name, and the household/family framing was removed by `DECISION-household-removal.md`.

### 6 — Rule identifiers

`COPILOT-SPEC.md` §3 shows `CARD-LVEF-001` and `COV-AUTH-002`; `WORK-PLAN.md` Days 6–7 names `SURV-LVEF-001`, `SURV-LVEF-002` and `COV-AUTH-001`. Eval ground truth and the UI's rule badges both carry these strings literally.

**Recommended: `WORK-PLAN.md`'s ids**, with `COPILOT-SPEC.md` §3's worked example corrected to match. A demo answer that cites a rule id no row carries is the kind of detail an 18-day judge finds.

### 7 — The answer schema has nowhere to put the refused practitioner

`COPILOT-SPEC.md` §2 shows only a Class B answer. §4 requires the Class A refusal to render a *"Generate evidence packet"* button **addressed to the named treating practitioner via `nmc_registration_no`**, and the frozen schema has no field for them. A UI cannot render a button whose target is buried in a prose string.

`frontend/contracts/answer_schema.json` as written adds an optional `refusal` object, required by an `if/then` when `classification` is `CLASS_A` — which closes the gap and makes a second constraint machine-checkable: **a refused question carries no claims.** Alternatives considered and why they lose are in `frontend/contracts/README.md`.

**Builder 1 owns Contract 3, so this is within Builder 1's authority to ratify** — but it is an addition to a frozen contract, so say it out loud and add a row to `COPILOT-SPEC.md` §7. Absorbing it silently is how the next person discovers the schema no longer matches the document it came from.

---

## Four inconsistencies that do not block Builder 1, but affect what the README may claim

| Item | The disagreement | Who resolves |
|---|---|---|
| Table count | 23 · 25 · 27 · 28 · 33 across five documents | Builder 2, before `IMPLEMENTATION-STATUS.md` is finalised |
| Eval set size | "80: 40 dev + 40 held-out" vs "80 dev + 80 held-out" | Builder 1 — **40/40 = 80 total**, two documents of three agree |
| Rule fixtures | 16 × 4 outcomes = 64 vs 16 × 5 cases = 80 | Builder 2 — the eval report cites whichever number ships |
| Corruption scenarios | headed "12", lists 13 | Builder 2 — it is **13**; scenario 13 is the one that proves R7 |

**Every one of these is a number that will appear in the README.** `AGENTS.md` §4: no claim in the README that is not demonstrable from the repo. Counting honestly is cheaper than defending a number later.

---

## The two things Builder 1 must not let slip

**R7 and consent are items 1 and 2 of the five things that win.** They are also the two most technically fiddly pieces in Stream 1, which means they are the two most likely to be deferred on a bad day. `WORK-PLAN.md` puts them at Days 2–3 and Days 3–4 for exactly that reason.

**Never cut:** R7 two-pass · consent at query time · `CURRENT_USER()` RAP · 4 skills + orchestrating Task · the working vertical slice.
**Cut in this order when needed:** MCP connector → `get_changes` → endocrinology rules → Navigator View → notifications → skill reuse tests.
