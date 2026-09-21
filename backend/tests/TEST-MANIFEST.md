# Test manifest

**Every test the Definition of Done requires, named before it is written.**

`ARCHITECTURE-HANDOFF.md` §4 and `WORK-PLAN.md` both define "done" per component, and in both the test *is* the definition — a tool procedure is not done because it works, it is done because a negative test proves it returns nothing for an unauthorised user. Listing them up front means the count is known on Day 1 rather than discovered on Day 15, and it doubles as CoCo testing-phase evidence, which our own research says most competitors omit.

**Convention:** a test is done when it **fails if the thing it protects is broken.** A test that passes against a stub, or that would still pass with the check deleted, is not evidence of anything.

| | |
|---|---|
| Owner `[1]` | Builder 1 |
| Owner `[2]` | Builder 2 |
| `—` | not written |
| `~` | written, fails |
| `x` | written, passes |

---

## 1 — Access control · `backend/tests/sql/access/` · `[1]`

**One negative test per tool. The expected result is *nothing* — not an error, not an empty-with-explanation. Nothing.**

| | Test | File | Proves |
|---|---|---|---|
| — | authorised caller gets rows | `t00_positive_control.sql` | the negative tests are not passing because everything returns empty |
| — | `get_patient_facts`, no care relationship | `t01_get_patient_facts_unauthorised.sql` | `no_patient_access`, revealing nothing about existence |
| — | `get_readiness`, no care relationship | `t02_get_readiness_unauthorised.sql` | |
| — | `get_readiness`, another patient's `encounter_ref` | `t02b_get_readiness_binding_mismatch.sql` | A1 under a different parameter name |
| — | `search_patient_documents`, no care relationship | `t03_search_patient_documents_unauthorised.sql` | |
| — | `search_reference_documents` returns no patient text | `t04_reference_no_patient_text.sql` | R6, from the tool side |
| — | `cohort_query` while a patient is bound | `t05_cohort_refused_while_bound.sql` | cross-patient inference blocked |
| — | `get_timeline`, no care relationship | `t06_get_timeline_unauthorised.sql` | |
| — | `get_changes`, no care relationship | `t07_get_changes_unauthorised.sql` | |
| — | `create_review_task` as `patient_navigator` | `t08_create_review_task_navigator_denied.sql` | role restriction on the only write tool |
| — | `create_review_task` twice with one `idempotency_key` | `t08b_create_review_task_idempotent.sql` | retries do not double-fire |
| — | consent revoked mid-session | `t09_consent_revoked_midsession.sql` | **the 30-second demo.** Same user, same question, nothing |
| — | no binding at all | `t10_no_patient_bound.sql` | `no_patient_bound`, UI prompts for a choice |
| — | binding released after `access_withdrawn` | `t11_binding_released_on_withdrawal.sql` | context cleared, not merely hidden |

**`t00` is not optional.** Thirteen tests that all expect "nothing" will all pass against a procedure that returns nothing to everybody. The positive control is what makes the other thirteen mean something.

## 2 — Extraction, R7 · `backend/tests/sql/extraction/` · `[1]`

| | Test | File | Expected |
|---|---|---|---|
| — | safety-critical, passes agree | `t20_verified.sql` | `verified`, value asserted |
| — | **safety-critical, passes disagree** | `t21_conflicting.sql` | **`conflicting`, value NOT asserted, both values retained** |
| — | pass B reports `legibility != clear` | `t22_unverified_legibility.sql` | `unverified`, value not asserted |
| — | pass B errors or times out | `t23_unverified_error.sql` | `unverified`. **Fail closed** |
| — | concept not safety-critical | `t24_single_pass.sql` | `single_pass`, one read accepted |
| — | **the ambiguous CBC page end to end** | `t25_ambiguous_cbc_gate.sql` | `CLIN-ANC-001` returns **`not_evaluated`, not `fail`** |
| — | no transition from conflicting to asserted | `t26_no_illegal_transition.sql` | attempting it fails |
| — | `10.3 L` | `t27_abnormal_flag_split.sql` | `value_num = 10.3`, `abnormal_flag = 'L'` |
| — | two specimens, different values | `t28_specimens_not_merged.sql` | two assertions, both carrying `specimen_id` |
| — | prompt injection inside a page | `t29_injection_is_content.sql` | quoted as content, never obeyed |

`t26` is the one worth arguing about. R7 is enforced by **the absence of a transition** in the state machine, not by a guard clause — so the test should attempt the illegal transition directly, not merely confirm the happy path.

## 3 — Validator · `backend/tests/sql/validator/` · `[1]`

**Six tests, one per check, each constructed to make that check fire.** Six tests that pass prove nothing.

| | Check | File | Fires when |
|---|---|---|---|
| — | 1 existence | `t30_evidence_missing.sql` | an evidence id resolves to no row or page |
| — | 2 scope | `t31_evidence_wrong_patient.sql` | evidence crosses the binding → strip **+ `SECURITY_EVENT`** |
| — | 3 version / temporality | `t32_superseded_or_future.sql` | `ingested_at > known_as_of`, or a superseded document |
| — | 4 polarity | `t33_polarity_contradiction.sql` | "no family history" cited for "family history" |
| — | 5 type match | `t34_numeric_cites_nonnumeric.sql` | a numeric claim cites a non-numeric source |
| — | 6 assertion trustworthiness | `t35_conflicting_assertion.sql` | **downgrades to a limitation, does not strip silently** |
| — | `AI_FILTER` unavailable | `t36_ai_filter_fails_closed.sql` | **claim stripped. Never pass-by-default** |
| — | `derived` missing on a computed value | `t37_derived_required.sql` | claim stripped — the schema cannot catch this one |

`t36` is the most valuable test in this table. A validator that fails open is worse than no validator, because it manufactures confidence.

## 4 — Classifier · `backend/tests/sql/classifier/` · `[1]`

| | Test | File | Expected |
|---|---|---|---|
| — | 20 questions, 10 per class | `t40_twenty_questions.sql` | every one classified correctly |
| — | Class A reaches no tool | `t41_no_retrieval_on_class_a.sql` | **proven from query history**, not from an empty answer |
| — | *"Is she ready?"* | `t42_ambiguous_defaults_to_a.sql` | Class A |
| — | keyword stage costs no LLM call | `t43_keyword_zero_latency.sql` | stage 1 short-circuits |

## 5 — Rules · `backend/tests/sql/rules/` · `[2]`

16 rules × 4 outcomes. Every rule returns the correct `rule_version` and a non-empty `evidence_ids` in each state. **Count settled with Builder 2** — `WORK-PLAN.md` says 64 (4 outcomes), `SPEC.md` §14 says 80 (5 cases, adding exact-boundary). Whichever ships is the number the eval report cites.

## 6 — Integration, the Day-5 gate · `[1]` + `[2]`

| | Check | Pass condition |
|---|---|---|
| — | UI calls real procedures | fixtures removed from the Ask screen; live data renders |
| — | agent calls real tools | tool invocations visible in query history |
| — | one patient end to end | document → parse → R7 → assertion → ontology → `CLIN-ANC-001` → cited answer |
| — | citation is clickable | clicking a claim opens the exact page, span highlighted |
| — | scope enforced | Practitioner 2 asks the same question → nothing |
| — | consent works | revoke → same question returns nothing |
| — | **no stub survives** | `backend/scripts/check_gate.py --all --strict` |

## 7 — Judge probes · `frontend/pages/6_Judge_Console.py` · `[1]`

Eight buttons, each showing its SQL and its result, **all runnable from the read-only `SAARTHI_JUDGE` role.** A probe that needs write access is a probe a judge cannot run, and judges spend 18 days alone with this repository.

| | Probe | Expected |
|---|---|---|
| — | 1 cross-scope attempt | blocked by the `CURRENT_USER()` RAP |
| — | 2 **search without the filter** | **returns another patient's text** — the competitor failure mode, live |
| — | 3 consent revoked | same question returns nothing |
| — | 4 injected instruction | treated as content |
| — | 5 fabricated claim | stripped, logged to `SECURITY_EVENT` |
| — | 6 low-quality image | two passes disagree, refuses to assert |
| — | 7 Class A question | refused in every role including oncologist |
| — | 8 regulatory question | answered from the real PM-JAY manual, page and clause |

## 8 — Eval · `backend/eval/` · `[1]`

| | Instrument | Target |
|---|---|---|
| — | `EXECUTE_AI_EVALUATION` | tool selection · tool execution · answer correctness · logical consistency |
| — | adversarial suite | **cross-scope leakage = 0** — a security property, not a quality metric |
| — | validator log | citation resolvability = 100% |
| — | corruption scenarios | 13 designed missing/conflict cases, all detected |
| — | `ground_truth_invocations` | **R6 machine-checked**: a patient question never invokes the reference tool, and vice versa |
| — | baseline plain-RAG | delta reported in both directions |

**Absolute counts alongside rates.** "94% on 80 questions", never "94% accuracy". Cold starts reported separately. **These are engineering gates on synthetic tests, not clinical validation** — say so in the report, not only in the deck.

---

## Running them

```sh
backend/scripts/check_gate.py --all --strict     # the mechanical checks
backend/tests/run_tests.py                       # the SQL suites
```

**Record failures.** Failure-and-fix pairs are the most credible lifecycle evidence available and judges are explicitly looking for evidence at every phase. Do not curate them out of the results file.
