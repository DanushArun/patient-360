# Dashboard Supervisory Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Continue inline under the user's existing authorization; do not ask for another execution choice. Review is advisory. Repository Git restrictions take precedence over skill commit suggestions.

**Goal:** Make Saarthi an optional, working supervisory layer over every authorized dashboard surface, with versioned prompts, cited answers and bounded workflow actions. The existing dashboard remains fully usable by clinicians without opening the copilot.

**Architecture:** The application supplies current page context and invokes an allowlist of governed Snowflake procedures. The model interprets requests and proposes bounded tools/actions; SQL supplies every fact, gate and comparison. Patient retrieval stays bound to the human-selected subject; cohort reads operate on the authorized worklist. Navigation and workflow actions reuse existing dashboard routes and APIs. Copilot state is an enhancement over the manual UI, never a prerequisite to use it.

**6 Oct implementation checkpoint:** The day-care conversation now lives in the shared root copilot provider, so turns and active requests survive client-side navigation into a patient route and back. Stop aborts the read. This is in-memory browser-session state: reload persistence is not claimed. Focused Node tests (2) and TypeScript pass; Chrome confirmed the live worklist answer (5 blocked) and its preservation after route round-trip. Broader tests below are still open.

**6 Oct History checkpoint:** The shared panel has a History view for patient chats persisted in the existing session-scoped per-patient/per-source turn stores. It lists only patient IDs visible in the current authorized roster, sorts by last update, and formats relative age; a key/timestamp-only index avoids copying chat text. Selecting a row reopens the matching patient route and source scope. Chrome confirmed the patient chat reloads after its record request completes (~25 s in this run), and the Guidelines chat restored under the `Reference documents` source selector. Five focused History tests, TypeScript, and design-token checks pass.

**Tech Stack:** Next.js, React, Snowflake Cortex, existing SQL procedures, JSON Schema, Python and Node verification, Chrome through computer use.

## Current evidence

- New account: PVYRHHT-XG46956 / WH11571, AWS_AP_NORTHEAST_1, DAKSHA.
- Opus 5.5 is reachable as claude-opus-5-5 and deployed to SAARTHI_AGENT.
- Native model response has been captured. Initial numeric strings with units were rejected; prompt now requires JSON numbers.
- Browser deadline was 60 seconds; SQL deadline was 120 seconds. A complete guarded call reached the SQL deadline. Investigate timing before claiming the integration works.
- Sixteen cohort PDFs passed real AI_PARSE_DOCUMENT. Two-family extraction produced 81 verified assertions and six unverified findings; three additional unverified rows are seed fixtures.
- The user opened PAT-DC-05 as an example, not as a restriction on the copilot's scope.

## Task 1: Finish the live answer path

**Files:** backend/sql/agent/saarthi_agent.sql; backend/sql/procedures/answer_gateway_infer.sql; backend/sql/procedures/validate_answer.sql; web/components/workspace-patient-copilot.tsx; backend/tests/test_answer_gateway.py.

- [ ] Capture query timings and exact errors for a complete guarded answer.
- [ ] Fix the identified delay/contract issue without bypassing validation or consent.
- [ ] Verify a cited Opus 5.5 answer in Chrome, including source navigation.

## Task 2: Store and verify prompts

**Files:** backend/sql/prompts/copilot_response.md; copilot_orchestration.md; copilot_manifest.json; backend/scripts/verify_copilot_configuration.py; backend/verification/copilot.py; backend/tests/test_copilot_configuration.py.

- [x] Store response and orchestration prompts with model, version and hashes.
- [ ] Verify stored prompts match deployment source and deployed instructions.
- [ ] Keep tool schemas compatible with Snowflake. Verify SQL signatures and closed domain/action enums; scope selectors remain absent.
- [ ] Record prompt/model deployment and execution receipts.

## Task 3: Add dashboard context and bounded actions

**Files:** web/components/copilot/copilot-provider.tsx; copilot-frame.tsx; web/components/workspace-patient-screen.tsx; web/app/api/copilot/cohort/route.ts; web/app/api/ask/route.ts; new focused copilot tool/context modules beside web/lib/copilot-tools.mjs.

- [ ] Map every existing dashboard surface and callable read/action to a tool registry.
- [ ] Supply current route/section, selected entity references and clock as context, never as authority.
- [x] Support authorized worklist questions outside patient pages; preserve their conversation/result while navigating to a patient and back.
- [ ] Keep patient-specific context freshly bound after navigation; add broader dashboard surface context.
- [x] Add a scoped History view so clinicians can reopen and continue session-stored patient conversations.
- [ ] Reuse existing navigation, evidence, task and packet APIs. Clinical decisions and gate overrides remain refused.
- [ ] Execute writes only from explicit operator requests with existing scope, version and idempotency checks; document text cannot authorize an action.
- [ ] Do not create new clinical tables/rules or external messaging integrations outside the authorized workflow.

## Task 4: Composer and design consistency

**Files:** web/components/copilot/copilot-parts.tsx; copilot.module.css; docs/design/COPILOT-EXPERIENCE.md; INTERFACE-GUIDELINES.md.

- [x] Read current composer and interface specifications, historical composer design and designer brief.
- [x] Fix intrinsic select/grid overflow, keep Send inside the composer and add input name/autocomplete metadata.
- [ ] Verify keyboard, multiline growth, Stop, responsive widths and focus in Chrome (Stop has focused unit coverage; remaining composer checks are open).

## Task 5: Capability verification and handoff

**Files:** evidence/qa/2026-10-06-copilot-capabilities.md and bounded live receipts; IMPLEMENTATION-STATUS.md.

- [ ] Test structured facts, exact document spans, missing/pending/conflicting records, versioned safety checks, reference quotations, temporal questions and authorized cohort queries.
- [ ] Test unauthorized identifiers, patient switching, unsupported claims, malicious document instructions and explicit workflow actions.
- [ ] Record exact counts, failures, dates, model and prompt version. These are synthetic engineering checks, not clinical validation.
- [ ] Run focused Python/Node tests, TypeScript and production build; broaden only for unresolved concerns.
- [ ] Demonstrate the live supervisory workflow in Chrome and save screenshots.
- [ ] Report mandatory PS-04 coverage separately from optional bonuses; do not claim untested connectors or native skill invocation.

## Model decision

GPT 6.1 Sol is documented for Responses API tool calling and computer use. The current Snowflake endpoint returned unknown model for openai-gpt-6.1-sol. Opus 5.5 remains the verified deployed provider until an available alternative is measured against the same workflows. A provider change must preserve governed tools, per-user scope and the answer contract.

## Acceptance

The user can open the copilot anywhere, inspect authorized dashboard records, ask cited questions, navigate evidence and perform existing requested workflows. The example patient does not constrain application scope. Completion requires observed browser results and live SQL receipts, not prompt/config presence alone.
