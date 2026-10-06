# Evaluation guide

This guide sets out how to evaluate Saarthi from the repository and the hosted application. It is organised by the
judging criteria for Problem Statement 04: **Real-World Relevance** (30%), **Technical Execution** (40%) and **Solution Completeness** (30%)
([`docs/PROBLEM-STATEMENT.md`](../PROBLEM-STATEMENT.md)).

Results marked *live* were recorded on a named Snowflake account; results marked *offline* can be reproduced from the
repository. All data is synthetic, and the engineering checks described here do not constitute clinical validation.

## 1. Hosted application

- The application is hosted at [saarthi-360.vercel.app](https://saarthi-360.vercel.app) and connected to a live
  Snowflake account populated with synthetic patients.
- **Day care** lists the next day's visits, grouped as *needs review*, *waiting on evidence*, *advisory* and *checks
  met*. Each blocked visit names the rule that blocked it.
- The record for **Anjali Deshpande** (`PAT-DC-12`) shows a failing LVEF surveillance check and a pre-authorisation
  that is *pending* in the table but *approved* in the letter, each with its rule version and evidence IDs.
- In the copilot, *"Why is she blocked?"* is answered from SQL with citations. *"Should we hold her trastuzumab?"*
  is declined as a clinical decision, and an evidence packet is offered to the treating practitioner.
- Each citation opens the source document, here the echo report page, with its event, recorded and ingested times.

This sequence is automated as the hosted demo check (`npm run demo:check` in `frontend/`): 19 of 19 steps passed on
the hosted app, with screenshots in [`evidence/demo/preflight/`](../../evidence/demo/preflight/).

## 2. Offline verification

The commands are listed under **Getting started** in the [README](../../README.md). Expected results: Python 565 passed / 14 skipped / 0
failed; web unit tests 381 passed; Playwright end-to-end 39 of 41 (stubbed API; the two failures are named in the
README); typecheck and production build clean. With live access off, `/design-preview/PAT-DC-07` shows a recorded
fixture, labelled as such.

## 3. Real-World Relevance

| Read | What to check |
|---|---|
| [README](../../README.md): *The challenge* and *The problem on the ward* | Each line of the brief mapped to what Saarthi does, and the day-care coordinator's question: what is missing, pending or conflicting before the next visit |
| [`classify_question.sql`](../../backend/sql/procedures/classify_question.sql), [`question-routing.mjs`](../../frontend/lib/question-routing.mjs), [`CLASSIFIER-TEST-SUITE.md`](../testing/CLASSIFIER-TEST-SUITE.md) | Clinical judgment is refused for every role; record and coverage questions go to deterministic tools. Legal basis: NMC Telemedicine Practice Guidelines 2020 |
| [`READINESS-CHECKS-EXPLAINED.md`](../clinical/READINESS-CHECKS-EXPLAINED.md), [`rule_fixtures.yaml`](../../data/fixtures/rules/rule_fixtures.yaml) | 16 versioned SQL rules with 80 fixtures. Never a model's opinion, never a confidence percentage |
| [`evidence/clinical/`](../../evidence/clinical/README.md) | 55 requirements quoted word for word from 13 official sources, checked by script against the rules' numbers, with the coverage gaps listed |
| [`DATASET-LICENCES.md`](../compliance/DATASET-LICENCES.md) | Synthetic-only position, reference document provenance and licence status |

## 4. Technical Execution

| Read | What to check |
|---|---|
| [`PLATFORM-FINDINGS.md`](../platform/PLATFORM-FINDINGS.md) | Dated Snowflake platform findings with query IDs, including the row access policy that must key on `CURRENT_USER()` |
| [`01_policies.sql`](../../backend/sql/governance/01_policies.sql), [`07_governance_row_access.sql`](../../backend/sql/deploy/07_governance_row_access.sql) | Scope enforced before retrieval |
| [`extract_one_document.sql`](../../backend/sql/procedures/extract_one_document.sql) | Two extraction passes from two model families at temperature 0; disagreement becomes `conflicting` and fails closed |
| [`evaluate_gates.sql`](../../backend/sql/procedures/evaluate_gates.sql) | Every status, number and threshold comparison comes from SQL |
| [`validate_answer.sql`](../../backend/sql/procedures/validate_answer.sql) | Six checks on every claim a model makes (existence, scope, time, entailment, type and value, trust); failing claims are stripped |
| [`reference-answer.mjs`](../../frontend/lib/reference-answer.mjs), [`catalog.json`](../../data/reference/catalog.json) | Regulatory answers quoted verbatim from fingerprinted official documents, with publisher, title, version and page |
| [`saarthi_agent.sql`](../../backend/sql/agent/saarthi_agent.sql) | The Cortex Agent: model pinned, generic tools only, no `patient_id` in any tool input |
| [`FAILURE-AND-FIX-INDEX.md`](../testing/FAILURE-AND-FIX-INDEX.md), [`evidence/qa/`](../../evidence/qa/) | Recorded failures with root cause, fix and verification status, and the uncurated QA, fix and deploy rounds |
| [`evidence/coco/`](../../evidence/coco/README.md) | CoCo lifecycle evidence by phase: planning, development, execution, testing |

## 5. Solution Completeness

| Read | What to check |
|---|---|
| [`IMPLEMENTATION-STATUS.md`](../../IMPLEMENTATION-STATUS.md) | Every component marked *built*, *partial* or *designed-only*, with the account and date it was exercised |
| [`backend/sql/deploy/`](../../backend/sql/deploy/README.md) | The ten-step Snowsight deploy bundle, with a VERIFY block per step |
| [`TESTING-PLAYBOOK.md`](../testing/TESTING-PLAYBOOK.md), [`PROTOTYPE-COST-CONTROLS.md`](../platform/PROTOTYPE-COST-CONTROLS.md) | How testing is run, and how cost is capped |
| [README](../../README.md): *Status and limitations* | What is not yet done |

## Known limitations

These match the README.

- **Synthetic data only**, 13 day-care patients. **Not clinically validated.**
- **One department mapped** (day-care chemotherapy), though rules, ontology and documents are data.
- **Single app role** on the hosted app; no per-user login yet.
- **No scored end-to-end evaluation** and no baseline comparison yet; 96 independent evaluation questions are written.
- **One reference document unreadable**: the PM-JAY Health Benefit Package 2.2 manual has no extractable text.
- **Skills authored, not loaded**: loading the four skills into the agent has not been verified on Snowflake.
- **No completed clean-account install.** A clean install attempt on 6 Oct failed and is recorded in [`clean-install-live.json`](../../evidence/qa/clean-install-live.json).
