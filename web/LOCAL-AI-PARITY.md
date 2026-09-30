# Local copilot parity — 27 September 2026

The local provider replaces copilot inference, not the governed data pipeline.
Snowflake still classifies questions, scopes retrieval, verifies extraction with two
different model families, calculates gates, and validates answer claims. A single
local Qwen model must not replace both R7 extraction passes.

## Implemented in the local adapter

- All eight existing procedure-backed copilot tools are available.
- Bounded multi-step planning can inspect tool results before choosing dependent calls.
- Every plan is validated before execution; unknown fields and patient selectors are rejected.
- Clinical questions never reach the local model. Classifier failure refuses closed.
- Retrieval errors stop the answer rather than inviting the model to explain or invent data.
- Task writes require an explicit request and an SQL-returned actionable readiness rule.
- Typed answer claims go through `VALIDATE_ANSWER`; validator errors strip the claims.
- Structured claim values, types, wording, and source clocks are constructed from returned
  SQL facts, not trusted from model prose. The model selects evidence, not clinical outcomes.
- SQL readiness results and task receipts are rendered without model reinterpretation.
- Evidence artifacts retain separate patient/reference tool results and actual query IDs.
- Unstructured model prose is stripped, not treated as a verified answer.

## Limits that must remain visible

- Mock tests prove adapter behavior, not deployed Snowflake procedure correctness.
- Document search depends on the deployed Cortex Search services. A returned page ID is
  not a verified assertion ID: unsupported document claims must be omitted.
- The SQL validator currently accepts structured and document-span evidence, not reference
  clauses. Reference results remain visibly separate source data, not validated claims.
- The adapter does not create or deliver a persistent `EVIDENCE_PACKET` on clinical refusal.
- Task close/reassign semantics are implemented by the existing SQL procedure, not by Qwen.
- The Snowflake connection uses `SAARTHI_APP` with secondary roles disabled and explicit
  per-developer environment configuration. It still uses one local key-pair identity;
  separate browser-practitioner authentication is preserved on the COM-11/COM-22 branches.
  Clean-account read-procedure/grant verification remains unfinished.

Run `npm run test:local-ai` and `npx tsc --noEmit` from `web/`.
