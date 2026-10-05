# Live release completion plan

> **For agentic workers:** Use executing-plans to implement this plan task by task.
> Track runtime receipts separately from source checks. A plan reviewer may review
> this document; account operations remain with the primary agent.

**Goal:** Deliver the SPEC-defined synthetic patient workflow through the real
Snowflake-backed dashboard and close the documented submission acceptance gates.

**Architecture:** Preserve R1–R7, the existing schemas and rules, scoped SQL-owner
tools, separate patient/reference corpora, independent extraction and canonical
answer validation. Deploy compatible existing sources in dependency order. Add
code only to fix a reproduced failure, using a failing regression first.

**Tech stack:** Next.js, TypeScript, Snowflake SQL/Tasks/Dynamic Tables, Cortex
Search/Agents/AI_COMPLETE, Python verification runners and Chromium/Chrome.

**Authorization:** User confirmed KGTPGHJ-YJ28449 / NY64016, approved 4 total
warehouse credits with the unchanged 90% immediate-suspend trigger, then asked
to make real data reach the dashboard and complete the documented system.
Do not submit the portal, push/merge/rebase/reset/tag, stage, or invent outcomes.
Preserve existing patient records. No trained prediction model or extra feature.
Financial account activation requiring payment details remains user-performed.

## Task 1 — Restore and prove the actual dashboard

**Sources:** `backend/sql/dynamic_tables/01_harmonized_events.sql`,
`backend/sql/procedures/validate_answer.sql`, `answer_gateway_rule.sql`,
`answer_gateway_record.sql`, `answer_gateway_reference.sql`,
`tools/02_get_readiness.sql`, `web_reads.sql`, `web_workflows.sql`,
`web_evidence.sql`, `web/lib/snowflake.ts`.

- [x] Reproduce empty Chrome worklist and HTTP 502; identify 090073 suspension.
- [x] Verify strict SDK connection, app role and secondary roles NONE.
- [x] Apply approved 3→4 quota change; retain 90% trigger and NEVER frequency.
- [x] Back up and deploy normalization, validator and citation adapters using
  COPY GRANTS; add required normalized UNIT; suspend normalization scheduling.
- [x] Observe 12 real accessible patients and 11 visits in Chrome.
- [x] Verify HTTP 200 for PAT-DC-04 snapshot/labs/documents and PAT-DC-07 comparison.
- [x] Verify actual PLT=82000 cited answer and named Class A refusal; both saved.
- [ ] Deploy the remaining compatible existing web/tools/gateway sources with
  backups and grants retained; do not execute setup.sql or reload CORE tables.
- [ ] Open source evidence in Chrome, save a reviewed follow-up and reopen
  immutable history; retain query/action/run IDs and failure/fix receipts.
- [ ] Set the exact server release identity; require actual SQL-receipt health.

Acceptance: a fresh Chrome session completes the real census → patient → facts →
source → answer/refusal → reviewed save → history path. Fixture routes do not count.

## Task 2 — Complete extraction, Search and native invocation

**Sources:** `backend/sql/search/01_patient_doc_search.sql`,
`02_reference_doc_search.sql`, `backend/sql/procedures/extract_one_document.sql`,
`backend/sql/agent/saarthi_agent.sql`, `backend/sql/agent/ask_saarthi.sql`,
`backend/sql/procedures/answer_gateway_context*.sql`, `answer_gateway_infer.sql`,
`backend/scripts/run_golden_loop.py`, `load_reference_documents.py`.

- [ ] Freshly probe native agent and two distinct extraction families. If account
  activation is required, capture its exact error and request user handoff.
- [ ] Verify actual document content and existing stage encryption before AI reads.
- [ ] Verify existing extractor source/deployed parity, deploy its tested source,
  then run two-family extraction on one new hash-checked synthetic input.
- [ ] Install two separate missing Search services, populate both corpora with
  existing approved input, and measure their independent controls. Search costs
  are separate from the warehouse monitor; avoid unattended serving spend.
- [ ] Run native skill selection and seven VQR invocation traces. Direct SQL
  execution alone remains a separate, weaker receipt.
- [ ] Run `run_golden_loop --config CONFIG --output REPORT`; require real new
  assertion, matching rule/version/source, canonical answer and persisted action.
- [ ] Run incremental positive work and identical replay; require no duplicates.

Acceptance: connected document → parsed page → verified cross-family assertion →
versioned SQL rule → cited answer/source → human review/history. Record failed
reads and disagreements; never manufacture ASSERTION rows to pass a gate.

## Task 3 — Independent quality and security evidence

**Sources:** `data/generated/evaluation-v2/`,
`backend/scripts/freeze_evaluation_gold.py`, `run_evaluation_benchmark.py`,
`verify_security_isolation.py`, `verify_consent_categories.py`,
`verify_history_receipts.py` and their existing backend tests.

- [ ] Load hash-checked PRE_AI evaluation input; extract all four held-out PDFs;
  freeze SQL-ID gold before answer scoring. Do not tune on held-out outputs.
- [ ] Run complete 48-question held-out denominators; adjudicate document claims;
  report correctness, citation precision, recall, missing/conflict outcomes/leaks.
- [ ] Capture cold and warm latency separately; require warm p95 ≤15s with counts.
- [ ] Run ten distinct connections with positive search controls, foreign canaries,
  concurrent writes, subsequent revocation and in-flight withdrawal evidence.
- [ ] Verify no duplicate receipt after lost response/retry and preserve history.
- [ ] When a check fails: reproduce, add behavioral regression, run red, fix
  minimally, run green and relevant suite, then redeploy and repeat actual case.

Acceptance: correctness/recall ≥90%, citations ≥95%, all designed missing/conflict
cases correct, zero scope leaks and complete evidence coverage. A PARTIAL report
is not PASS; skips and failures remain in denominators as designed.

## Task 4 — Judge-accessible release and operating evidence

**Sources:** `backend/scripts/release_preflight.py`, `install_clean_account.py`,
`prepare_hosted_package.py`, `web/app/api/health/route.ts`,
`docs/submission/TEAMMATE-ACCOUNT-RUNBOOK.md`,
`CONSUMPTION-CAPTURE-RUNBOOK.md`, `simulate_workflow_economics.py`.

- [ ] Validate restricted host identity and actual frontend/backend revision; host
  real backend and run release_preflight plus fresh Chrome workflow remotely.
- [ ] Run canonical installation only on an approved empty/disposable account,
  retaining hashes, query transcript and rollback procedure.
- [ ] Capture actual attributed warehouse, Search and AI usage for a completed
  review. State price, currency and operating-volume assumptions explicitly.
- [ ] Conduct real timed operator comparisons with counterbalanced order and
  adjudicated correctness. Ask user for operator participation when ready;
  simulations never become observed human results.
- [ ] Confirm account funding, availability and named operating owner through
  judging. Verify portal availability without submitting any form.

## Task 5 — Freeze truthful submission artifacts

**Files:** `README.md`, `IMPLEMENTATION-STATUS.md`,
`docs/GRAND-FINALS-EVALUATION-2026-10-04.md`,
`docs/submission/RELEASE-GATES-2026-10-05.md`, deck and finals script.

- [ ] Reconcile every current claim against final runtime receipts and revision.
- [ ] Preserve historical failures and account-specific metrics; do not transfer
  old proof to the final account without rerunning it.
- [ ] Render/validate final deck with actual impact, licenses and working links.
- [ ] Record the final demonstrable revision last and verify its accessible link.
- [ ] Run fresh required source checks and independent review; leave reviewable
  changes unstaged unless explicitly authorized otherwise.

No judging-score guarantee is an acceptance criterion. The release-gate proof and
usable workflow are the objective; unsupported 100/100 claims are removed.
