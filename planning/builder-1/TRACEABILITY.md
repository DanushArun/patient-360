# Traceability — requirement → artifact → proof

**Every requirement Builder 1 is accountable for, the file that implements it, and the thing that proves it.**

The point of this table is that "meets all requirements" becomes checkable rather than hoped-for. It is also the single most useful artifact for the 18 days judges spend alone with this repository: a requirement with no proof column is a requirement we are claiming rather than demonstrating, and `AGENTS.md` §4 forbids the first.

**A row is only closed when the proof column runs and fails if the implementation is broken.** "It works on my machine" is not a proof column.

---

## 1 — The seven rules. Violating one is a defect, not a design choice.

| Rule | What it demands of Builder 1 | Implemented in | Proved by |
|---|---|---|---|
| **R1** | the LLM never decides — no status, number, date, threshold comparison or gate outcome comes from a model | agent instructions in `backend/sql/agent/saarthi_agent.sql`; `GetReadiness` calls `evaluate_gates` and never recomputes | `backend/tests/backend/sql/rules/` returns the same outcomes with the agent absent; diagram 4 has no amber box |
| **R2** | every answer carries `known_as_of`; three clocks survive to the UI | `answer_schema.json` requires it; `_preamble.sql` resolves it **first**, so even errors carry it | schema rejects an answer without it — `check_gate.py --contracts` |
| **R3** | missingness is a type — "not received" is never "negative" | `pass_a_*.md` prompts return `missingness_state`; four-valued `outcome` on every claim | `t24`, `t25`; `answer_conflicting.json` renders three distinct outcomes in one answer |
| **R4** | ambiguous identity contributes **no** evidence | consumed, not implemented, by Builder 1 — the identity gate | `ID-QUAR-001` fixtures `[2]` |
| **R5** | scope enforced server-side, three layers, before retrieval | `_preamble.sql` + the three-step body of `03_search_patient_documents.sql` | `backend/tests/backend/sql/access/` — 14 tests, including a positive control |
| **R6** | two corpora, never mixed in one ranked list | separate tools over separate services; `reference_clause` renders distinctly | `t04`; **`ground_truth_invocations` machine-checks it across all 80 eval questions** |
| **R7** | never assert a safety-critical value from one unverified read | `backend/sql/tasks/extract_assertions.sql`, `pass_b_verify.md` | `t21`, `t25`, `t26` — and `t26` attempts the illegal transition directly |

## 2 — The verified platform facts that constrain Builder 1's code

Each was established empirically and each fails somewhere other than where the mistake is.

| # | Fact | Where it binds Builder 1 | Proved by |
|---|---|---|---|
| F3 | `CURRENT_USER()` survives owner's-rights elevation; `CURRENT_ROLE()` does not | `_preamble.sql` resolves the practitioner from `CURRENT_USER()` | `t01`; U2 query id |
| F5 | Cortex Search ignores row access policies | tool 3 re-fetches text from `DOC_PAGE`, never returns index text | Judge probe 2 — the leak reproduced, then closed |
| F7 | secondary roles defeat a `USAGE`-based control | `frontend/core/session.py` runs `USE SECONDARY ROLES NONE` on every session | both query ids recorded — with and without |
| F8 | `AI_FILTER` text form takes **one** argument | `validate_answer.sql` check 4 | `t33` discriminates; `t36` proves it fails closed |
| F9 | AI functions cannot read non-SSE stages | skills upload to the SSE `SKILLS` stage | step 19 runs clean on a clean account |
| **A1** | the agent derives `patient_id` from question text and injects the filter itself | **no patient selector in any tool schema** | `check_gate.py --params` fails the build on regression |
| — | `GCP_ME_CENTRAL2` is in no regional availability table; every model arrives cross-region and the published roster is an upper bound | model choices in `extract_assertions.sql` and the agent spec | `backend/sql/probes/model_availability.sql`, Day 1, query IDs recorded |
| — | `orchestration: auto` re-selects upward when a stronger model lands, changing cost and invalidating measured accuracy | `models.orchestration` **pinned** in the agent spec | grep the agent spec for `auto`; re-run eval after any deliberate change |

## 3 — The brief, line by line

| Brief text | Builder 1's part | Proved by |
|---|---|---|
| *"Deliver a question and answer experience with clear source evidence"* | Ask + Evidence is the primary screen, not one tab of six | Day-5 gate: click a claim, the exact page opens with the span highlighted |
| *"with cited evidence"* | `minItems: 1` on `claim.evidence`; typed, three kinds | schema rejects an uncited claim; citation resolvability 100% in the validator log |
| *"answers clinical, safety, or regulatory questions"* | 10 Class B types, each with a tool path | all ten answer with the agent on **and with the agent disabled** |
| *"risk stratification … never opaque predictions"* | gate outcomes reported, never computed; no trained model anywhere | every claim carries `rule_id` + `rule_version`; no model in the readiness container |
| *"Combine structured records with unstructured documents"* | one answer mixes `structured` and `document_span` evidence | `answer_supported.json` does exactly this |
| *"evidence retrieval"* | dual corpora, physically separate | `t04` + `ground_truth_invocations` |
| *"reusable skills remain the headline bonus"* | 4 skills + orchestrating Task | reuse test per skill: one mapping **and one refused ambiguity** |
| MCP connectors | 2 read-only tools, no patient-scoped tool exposed | `saarthi_mcp.sql` lists two identifiers |
| custom tools / function calling | 8 generic tools over procedures | `tool_signatures.yaml` |
| multi-agent orchestration | `TASK_SAARTHI_ORCHESTRATOR` chains the 4 skills | the task runs and the skills are invoked |
| guardrails / graceful fallback | 11 named situations in `error_shape.json` | `frontend/core/errors.py` covers all 11; fallback router tested **with the agent off** |

## 4 — Go / no-go. Any one of these true is a no-go.

| Condition | What stops it | Checked by |
|---|---|---|
| any answer is hard-coded | stubs live in a separate `STUB` schema and are deleted at the Day-5 gate | `check_gate.py --stubs` |
| evidence links are decorative | fixture offsets generated from page text, never typed | `check_gate.py --contracts`; Day-5 click-through |
| the agent can cross patient scope | `patient_id` absent from every input schema | `check_gate.py --params` |
| consent revocation does not actually block | re-validated on every call, never cached in the binding | `t09` |
| the late-update path is simulated | `TARGET_LAG = '1 minute'` on the patient service `[2]` | demo beat 2, live |
| two-pass verification is claimed but not wired | two model **families**, and no transition to asserted from conflicting | `t21`, `t26` |
| `setup.sql` fails on a clean account | manifest, idempotency, no stub references | Day-15 rehearsal + `--strict` |
| CoCo evidence exists only for code generation | failure-and-fix pairs retained, not curated out | `evidence/coco/` across all four phases |

## 5 — The five things that win, and what would silently undo each

Ranked. If the schedule collapses, these survive in this order.

| # | Claim | The silent failure that would undo it |
|---|---|---|
| 1 | **R7 two-pass extraction verification** | pass B on a model from the **same family** as pass A. Same-lineage agreement measures confidence, not correctness — and nothing in the output looks different. **This already happened once:** the original `llama3.3-70b` / `llama3.1-70b` pairing was documented as cross-family and was not. Pass B is `claude-haiku-4-5`; fallbacks are non-Llama by rule. |
| 2 | **consent enforced at query time** | caching the consent check in the binding "for performance". The demo still runs; revocation silently stops working. |
| 3 | **`CURRENT_USER()`-keyed RAP, proven** | a policy keyed on `CURRENT_ROLE()`. Looks perfect in single-user testing because the owner is the caller. `[2]` |
| 4 | **4 skills + orchestrating Task** | instructions placed in SKILL.md frontmatter, which agents ignore. Loads, runs, does nothing. |
| 5 | **a working vertical slice, deployed** | a stub surviving past Day 5 |

**Each of these five has a mechanical check, because each is invisible by inspection.** That is the whole argument for `backend/scripts/check_gate.py` existing at all: the failures that cost the most here do not announce themselves.

## 6 — Honesty obligations, worth 30%

| Obligation | Where it lands |
|---|---|
| no README claim that is not demonstrable from the repo | every claim maps to a row above |
| absolute counts alongside rates | `backend/eval/results/` — "94% on 80 questions", never "94% accuracy" |
| cold starts reported separately | `backend/eval/results/` |
| engineering gates on synthetic tests ≠ clinical validation | stated in the eval report, not only in the deck |
| `QUERY_HISTORY` live, `ACCESS_HISTORY` up to 180 min stale | each Judge Console probe labels which it used |
| three thresholds are practice consensus | `provenance_note` travels from the rule into the claim and into the UI |
| `IMPLEMENTATION-STATUS.md` accurate for every component | updated the day a thing is built, not on Day 15 |

**Our own accurate list of gaps beats a judge's discovery that we overclaimed** — which is the exact failure we document in competitors, and the reason this file has a proof column rather than a status column.
