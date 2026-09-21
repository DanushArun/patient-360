# SAARTHI — Builder 1 Build Plan

**Stream 1: copilot, agent, tools, extraction, validator, skills, eval, Streamlit.**
**Seventeen days. One vertical slice by Day 5 or cut scope that day.**

Every task names the files it creates, the specification that defines its behaviour, what "done" means, and what to stub if Builder 2's half does not exist yet. **Never wait.**

---

## Before writing code — 90 minutes, not optional

| # | Read | Why |
|---|---|---|
| 1 | `AGENTS.md` | R1–R7 and 10 verified platform facts. Violating one is a defect, not a design choice. |
| 2 | `COPILOT-SPEC.md` §0 | Why no tool takes a patient selector. It changes how every tool is called. |
| 3 | `ARCHITECTURE-DIAGRAMS.md` 3, 6, 8 | Containers, trust boundaries, R7. |
| 4 | `planning/builder-1/AGENT-DEV-PLAN.md` | The interfaces you own and the seven decisions already made. |
| 5 | `planning/builder-1/REPO-STRUCTURE.md` | Where things go and which directories are not yours. |
| 6 | `SPEC.md` §2 | The data model your procedures read. Skim the rest. |

---

## Day 1 — freeze the contracts, prove the platform assumptions

Four deliverables. **The model probe comes first** — everything in the extraction path depends on its result, and two of the contracts unblock Builder 2.

### 1.0 — Model access probe ⚠️ before anything else · `sql/probes/model_availability.sql`

```sql
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE SAARTHI_APP;
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';
SHOW PARAMETERS LIKE 'CORTEX_ENABLED_CROSS_REGION' IN ACCOUNT;
```

Then probe pass A, pass B and its fallbacks, the classifier model, and the orchestration candidates. **Record every result — available and unavailable — with its query ID.**

**Why first.** `GCP_ME_CENTRAL2` is in **no** Snowflake regional availability table; every model arrives cross-region, so the published roster is an upper bound and never a guarantee. The only prior evidence is a 17 Sept probe that predates a model generation — and `llama3.1-70b`, which the original R7 pass B depended on, has since been marked `[legacy]`.

**Done when:** `claude-haiku-4-5` is confirmed reachable (or a fallback is chosen and the reason written down), `orchestration` is **pinned** rather than `auto`, and the results are in `evidence/coco/verification-query-ids.md`.

### 1.1 — Ratify the contracts · `app/contracts/`

**All three are already written and verified.** `scripts/check_gate.py --contracts` passes ten checks: three fixtures validate, and six malformed answers are correctly rejected. `--params` confirms no patient selector exists in any agent-visible signature.

Day 1 is therefore review, not authoring:

- read `app/contracts/README.md` — it explains every constraint and why
- **decide item 7** in `planning/builder-1/README.md`: the `refusal` object is an addition to a frozen contract. Ratify it, or replace it with something that lets the UI render the evidence-packet button
- tell Builder 2 the three files are frozen, and settle items 1–6 with them

**Done when:** the gate passes, item 7 is decided, and Builder 2 has confirmed items 1–6.

### 1.2 — Streamlit scaffold against a fixture · `app/streamlit_app.py`, `app/pages/1_Ask_and_Evidence.py`

Build the **entire** Ask + Evidence screen against hard-coded fixtures. Do not wait for a single table to exist.

Must render: question box · per-claim answer · evidence pane opening on claim click · `known_as_of` · Class A refusal with the named practitioner and the packet offer · **the three evidence kinds rendered differently** — `structured` as a row with its three clocks, `document_span` as a page with the span highlighted and a verification badge, `reference_clause` visually distinct from both (R6 is not only about ranked lists).

**Done when:** load the app, click a claim, the evidence pane opens on the fixture's page; switch to the Class A fixture and the refusal renders with a practitioner named.

### 1.3 — Close U2 and U3 before they become Day-14 problems

| # | Test | If it fails |
|---|---|---|
| U2 | Does `CURRENT_USER()` inside deployed Streamlit return the caller? | dedicated service user granted only the app role (F7 path 2) |
| U3 | Does `CREATE STREAMLIT … COMPUTE_POOL` work on this account? | warehouse runtime + `AGENT_RUN` — proven by F1 |
| U4 | Is `jsonschema` (or your validation library) in the Snowflake Anaconda channel? | hand-rolled validation in `app/core/schema.py` |
| U5 | Does `claude-haiku-4-5` answer on this account? | fall back `mistral-large3` → `qwen3-32b`. **Never a second Llama** |

**U1 is closed — do not spend Day 1 on it.** `AI_PARSE_DOCUMENT` bills per page at 970 tokens per page, so a 300-page corpus is **$0.03–$1.50**, not the $78 the cost model feared. That figure added CoCo CLI development credits to runtime token billing; they are separate budgets. Tier 2 corpus is unblocked.

**Record every query ID in `evidence/coco/verification-query-ids.md`.** Ten of the best claims in this submission came from testing a platform assumption instead of trusting it — and the eleventh came from checking a model claim against the vendor's own roster.

---

## Day 2 — Class A/B classifier · `sql/procedures/classify_question.sql`

Four-stage cascade per `AGENT-DEV-PLAN.md` §3: keyword → structure → `AI_CLASSIFY` → **default Class A**.

**Done when:** 20 questions, 10 per class, classify correctly; every Class A is refused **before any retrieval**, proven from query history showing no tool invocation; ambiguous questions land in Class A.

**Do not skip the ambiguity cases.** *"Is she ready?"* is the one that matters — it can mean record-readiness or clinical readiness, and it defaults to A.

---

## Days 2–3 — R7 two-pass extraction · `sql/tasks/extract_assertions.sql`, `sql/prompts/`

The differentiator. Full step table in `AGENT-DEV-PLAN.md` §6.

**Models: pass A `llama3.3-70b`, pass B `claude-haiku-4-5`, `temperature: 0` on both.** Pass B changed on 20 Sept — the original `llama3.1-70b` is the **same Meta family** as pass A, so the independence the claim rests on did not exist, and it is now `[legacy]` besides. Confirm both against §1.0's probe output before writing the task.

**Depends on:** `DOC_PAGE` rows from Builder 2's `parse_documents` task (Day 3–4 for them).
**Stub if blocked:** insert three `DOC_PAGE` rows by hand — one clean lab page, one pathology page, one deliberately ambiguous CBC. You need the ambiguous page as a fixture anyway; building it yourself on Day 2 removes the dependency entirely.

**Done when:**
- a safety-critical concept runs both passes on two **genuinely** different model families — different vendor, not a different version of the same lineage
- agreement → `verified`; disagreement → **`conflicting`, value not asserted**; pass B error or `legibility != clear` → **`unverified`, value not asserted**
- `pass1_value` and `pass2_value` are both recorded in every case
- the ambiguous CBC page produces `conflicting` and `CLIN-ANC-001` returns `not_evaluated` — **not `fail`**

**The trap:** it is tempting to let a `conflicting` assertion through with a caveat. There is no transition from `Conflicting` to `Asserted` in diagram 12, and the guarantee comes from the missing edge, not from a guard clause.

---

## Days 3–4 — Tool procedures 1–4 · `sql/procedures/tools/`

`01_get_patient_facts` · `02_get_readiness` · `03_search_patient_documents` · `04_search_reference_documents`, each opening with the preamble in `_preamble.sql`.

**Every one:** `EXECUTE AS OWNER` · resolves `PATIENT_BINDING` from `CURRENT_SESSION()` · re-validates `CARE_TEAM` and `CONSENT` **on every call** · returns the uniform error shape · **takes no patient selector of any kind.**

**Tool 3 specifically:** inject the `@eq` filter server-side → take **chunk IDs only** → re-fetch text from RAP-protected `DOC_PAGE`. Returning the index's own `text` column is the F5 leak reproduced, and it will pass single-user testing.

**Depends on:** `bind_patient` and live `CARE_TEAM`/`CONSENT` rows (Builder 2, Days 2–3) and the search services (Builder 2, Day 9).
**Stub if blocked:** `sql/stubs/stub_tools.sql` — signature-identical procedures over fixture rows in a `STUB` schema. For tool 3 before the search service exists, substitute a `LIKE` scan over `DOC_PAGE`; the three-layer structure stays identical and only the retrieval line changes later.

**Done when:** each procedure has **a negative test proving it returns nothing for an unauthorised user.** Not an error. Nothing.

---

## Days 4–5 — Agent wired to real tools · `sql/agent/saarthi_agent.sql`

`orchestration: auto` · only `generic` tools over procedures · `patient_id` absent from every input schema · `tool_resources` identifiers matching the created procedure names exactly. Generate the `tools:` block from `tool_signatures.yaml`.

**Done when:** a question naming a patient the user has no access to produces no query for that patient, **verified by reading the generated tool call in the run trace** — the parameter does not exist, so the filter cannot be constructed. An empty answer alone does not prove this.

---

## Day 5 — Answer validator · `sql/procedures/validate_answer.sql`

Six checks per `AGENT-DEV-PLAN.md` §5. `AI_FILTER` one-argument text form — F8, verified; four earlier guesses at this syntax cost real time and the docs had it.

**Done when:** six tests exist, one per check, **each constructed to make that check fire**. Check 6 downgrades to a limitation rather than stripping silently. `AI_FILTER` error → claim stripped, never passed by default.

---

## Day 5 — the gate. Everything above, integrated.

| Check | Pass condition |
|---|---|
| UI calls real procedures | fixtures removed from the Ask screen; live data renders |
| Agent calls real tools | tool invocations visible in query history |
| One patient end to end | document → parse → R7 → assertion → ontology → `CLIN-ANC-001` → cited answer |
| Citation is clickable | clicking a claim opens the exact page with the span highlighted |
| Scope is enforced | Practitioner 2 asks the same question → nothing |
| Consent works | revoke → same question returns nothing |
| **No stubs survive** | `scripts/check_gate.py --all --strict` exits 0 |

The last row is mechanical on purpose. From Day 5 onward `--strict` turns every skipped check into a failure, so "the agent spec is not written yet" stops being an acceptable answer on the day it stops being true.

**If any row fails, cut scope today. Not Day 12.** Order: MCP → `get_changes` → two specialties → Navigator View. **Never cut R7, consent, or citations.**

---

## Days 6–7 — Tool procedures 5–9

| # | Procedure | The thing that is easy to get wrong |
|---|---|---|
| 5 | `cohort_query` | **must be unavailable while a patient is bound.** Mixing a bound conversation with cross-patient results is how a coordinator misreads one patient's data as another's. |
| 6 | `get_timeline` | three R2 clocks and the sending facility, not one date |
| 7 | `get_changes` | diffs two `known_as_of` states — the question no competitor can express |
| 8 | `create_review_task` | the only write tool. Idempotent via `idempotency_key`. `treating\|coordinator` only — `patient_navigator` cannot create tasks. `action` is an enum and "approve treatment" is not a value in it. |
| 9 | `bind_patient` | **Builder 2 writes this on Days 2–3.** Your job here is the negative tests and the UI integration, not a second implementation. |

---

## Days 7–8 — All 10 Class B question types, and the fallback router

Every type gets a tool path. D10 found four types with no path — the agent would have refused a legitimate question or hallucinated. Routing table in `AGENT-DEV-PLAN.md` §7.

**Build `app/core/router.py` here, not later.** It is the graceful-fallback bonus and it is twenty lines once the tools exist.

**Done when:** all ten types answer with the agent enabled, **and all ten answer with the agent disabled.** Test the fallback by turning the agent off, not by reading the code.

---

## Days 8–9 — The remaining screens

`WORK-PLAN.md` gives Stream 1 the UI but never schedules screens 2–4. They fit here, minimally.

| Screen | Minimum that counts as built |
|---|---|
| Review Queue | open gate failures ordered by `severity` × `days_to_visit`, each opening to its rule and evidence |
| Patient 360 | gate strip with four outcomes · facility timeline · discordance flags |
| Review + History | task lifecycle · document version chain · `ANSWER_RUN` history |

**These are the compressible item in Phase 2.** If Days 6–7 overrun, ship Review Queue and Patient 360 and mark Review + History `partial` in `IMPLEMENTATION-STATUS.md` with the limitation named. That is a better outcome than three half-screens.

---

## Days 9–10 — Eval harness · `eval/`

80 questions, 40 dev + 40 held out, split by patient **and** document layout so no layout leaks across the split.

Native `EXECUTE_AI_EVALUATION` for the four GPA metrics; our own harness for cross-scope leakage, citation resolvability, the corruption scenarios, and the baseline RAG delta. Truth key in the `EVAL` schema, **unreadable by the app role.**

**`ground_truth_invocations` machine-checks R6:** a patient question's expected invocation set must not contain `SEARCH_REFERENCE_DOCUMENTS`, and vice versa.

**Done when:** results are machine-readable and committed, the baseline delta is reported in both directions, and every number is an absolute count alongside its rate. Cold starts reported separately.

---

## Days 11–12 — 4 skills + orchestrating Task · `skills/`

`clinical-question-routing` · `evidence-retrieval` · `risk-stratification` · `evidence-reconciliation`. Each a folder with `SKILL.md`; the agent references the folder, not the file. Uploaded by `setup.sql` via `COPY INTO`, no local `PUT`, so deployment stays reproducible from SQL alone.

`TASK_SAARTHI_ORCHESTRATOR` chains them — multi-agent orchestration in the same move.

**Reuse proof is the half that gets skipped and the half that scores.** Run each skill against a second synthetic schema with different column names. Show one successful mapping **and one ambiguity it correctly refuses to resolve.** The refusal is the stronger demo.

---

## Days 12–13 — Judge Console, 8 probes · `app/pages/6_Judge_Console.py`

Each probe is a button showing the SQL and the result.

| # | Probe | Expected |
|---|---|---|
| 1 | cross-scope attempt | blocked by the `CURRENT_USER()` RAP |
| 2 | **search without the filter** | **returns another patient's text** — F5, the competitor failure mode, live |
| 3 | consent revoked | same question returns nothing |
| 4 | injected instruction in a document | treated as content, not instruction |
| 5 | fabricated claim | validator strips it, logs to `SECURITY_EVENT` |
| 6 | low-quality image | two passes disagree → refuses to assert |
| 7 | Class A question | refused in every role including the oncologist |
| 8 | regulatory question | answered from the real PM-JAY manual, page and clause |

**Probe 2 is the strongest claim in the submission.** It reproduces a vulnerability two of four surveyed competitors ship, with the query ID on screen, and then shows it closed. Make it work from the read-only `SAARTHI_JUDGE` role — judges spend 18 days alone with this repo and a probe that needs write access is a probe they cannot run.

---

## Days 13–14 — MCP connector · `sql/agent/saarthi_mcp.sql`

Two read-only tools: `get_readiness` and `search_reference_documents`. **`get_patient_facts` and `search_patient_documents` are deliberately excluded** — an MCP client is outside our identity chain, so patient-scoped tools stay inside the app boundary.

Outbound: one documentation blocker → one tracked ticket, carrying only a synthetic patient id and an authenticated evidence link, with `idempotency_key` proving retries do not double-fire.

**First on the cut list.** If Day 13 arrives and the eval or the skills are not finished, cut this without discussion.

---

## Days 15–17 — freeze

| Day | Task |
|---|---|
| 15 | Clean-account deploy. Builder 2 runs `setup.sql` on a fresh account; **you verify agent, tools, and UI work there.** Reserve the half-day. |
| 15 | `IMPLEMENTATION-STATUS.md` — every Builder 1 row marked `built \| partial \| designed-only`, accurately |
| 16 | README a stranger can follow. You write it; Builder 2 follows it on the clean account **without helping you**. |
| 16 | CoCo evidence manifest across planning, development, execution, testing |
| 17 | Demo rehearsal, 7 beats, recorded |
| 17 | **Cold-start test by whoever built less of it** |

**A deploy that only works on an account carrying leftover development state is the most likely way to lose Solution Completeness, and it is invisible until tested.**

---

## Load warning

**Days 2–5 carry the classifier, R7 extraction, four tool procedures, the agent, and the validator** — five components, four of them in SQL, against a schema being created the same week. It is the densest stretch in either stream by a clear margin.

Two things buy the time back:

1. **Build the ambiguous CBC page yourself on Day 2.** It is your R7 fixture and your demo asset, and making it removes a dependency on Builder 2's document generation entirely.
2. **Stub aggressively and delete on Day 5.** `sql/stubs/` exists for exactly this. The Day-5 gate has a stub-deletion check precisely because stubbing early is the right move.

If Day 4 ends without tools 1–3 returning real rows, **say so that evening**, not on Day 5. The gate exists to be called early.

---

## When you are blocked

| Blocker | Do this |
|---|---|
| Builder 2's component does not exist | build against the contract with a stub. **Never wait.** |
| A contract seems wrong | say so before changing it. It is frozen for the other person, not for its owner. |
| A platform behaviour surprises you | test it, record the query ID in `evidence/coco/verification-query-ids.md`, design around what you observed |
| An AI function will not compile | run `cortex search docs` before guessing. Four consecutive failed guesses at `AI_FILTER` syntax cost real time; the docs had it. |
| Tempted to add a table or a feature | don't. `SPEC.md` is the scope. Designing more than we build is actively negative on Completeness. |

**Record failures.** Failure-and-fix pairs are the most credible lifecycle evidence available, and judges are explicitly looking for evidence at every phase. Do not curate them out.
