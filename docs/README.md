# SAARTHI Documentation Directory

This directory organizes all project documentation, specifications, guidelines, and evaluation materials into clear, topic-specific subdirectories.

---

## Directory Overview

| Directory | Purpose | Key Contents |
|---|---|---|
| [`design/`](./design/) | UI/UX guidelines, design systems, and screen specifications | Apple HIG adaptations, design tokens, copilot UX, designer briefs |
| [`clinical/`](./clinical/) | Medical logic, readiness gates, and protocol definitions | Explanation of all 16 clinical readiness checks and rule thresholds |
| [`platform/`](./platform/) | Snowflake architecture, execution environment, and tooling | Empirical platform findings, credit/cost controls, MCP quickstart |
| [`testing/`](./testing/) | QA, test suites, playbooks, and failure tracking | Testing playbooks, classifier test suites, 34 recorded failure/fix index |
| [`submission/`](./submission/) | Competition submission, presentation decks, and judge walkthroughs | Judge walkthroughs, slide deck outlines, PPTX files, final scripts |
| [`compliance/`](./compliance/) | Licences, patient data consent, and third-party references | Data attribution, reference literature licenses, ethics statement |
| [`project/`](./project/) | Project-level overview and implementation scope maps | High-level system overview and component completeness mapping |
| [`history/`](./history/) | Historical milestones, audit trails, and execution handoffs | Workspace baselines, reconciliation audits, execution handoffs |
| [`superpowers/`](./superpowers/) | Structured agent plans and feature specifications | Subagent planning specs, reconciliation plans |

---

## Folder Details & Documents

### 1. [`design/`](./design/) — Interface & UX Guidelines
- **[`INTERFACE-GUIDELINES.md`](./design/INTERFACE-GUIDELINES.md)**: The binding interface standard for all SAARTHI web screens, adapted from Apple's Human Interface Guidelines (macOS desktop workstation focus, 8 typography tokens, 4px grid, 32px controls, semantic colors).
- **[`COPILOT-EXPERIENCE.md`](./design/COPILOT-EXPERIENCE.md)**: UX specification for the embedded clinical copilot, translating OpenAI Apps SDK & ChatGPT desktop patterns into a governed medical workflow.
- **[`DESIGNER-BRIEF.md`](./design/DESIGNER-BRIEF.md)**: Product overview and detailed layout walkthrough for all 6 core screens and user roles.
- **[`ROLE-BASED-SCREEN-INVENTORY.md`](./design/ROLE-BASED-SCREEN-INVENTORY.md)**: Screen matrix mapped by user persona (Coordinator, Oncologist, Family Navigator, Hackathon Judge).

### 2. [`clinical/`](./clinical/) — Clinical Gates & Readiness Logic
- **[`READINESS-CHECKS-EXPLAINED.md`](./clinical/READINESS-CHECKS-EXPLAINED.md)**: Plain-language and medical explanation of all automated checks (ANC, Platelets, LFT, Creatinine, Insurance Pre-auth, Identity match, etc.).

### 3. [`platform/`](./platform/) — Snowflake & Architecture
- **[`PLATFORM-FINDINGS.md`](./platform/PLATFORM-FINDINGS.md)**: Verified platform behaviors, query IDs, RAP constraints, and Snowflake Cortex AI empirical limits.
- **[`PROTOTYPE-COST-CONTROLS.md`](./platform/PROTOTYPE-COST-CONTROLS.md)**: Credit limits, warehouse sizing, suspend timers, and token cost controls.
- **[`MCP-QUICKSTART.md`](./platform/MCP-QUICKSTART.md)**: Quickstart guide for Model Context Protocol (MCP) integrations with Snowflake.

### 4. [`testing/`](./testing/) — QA & Reliability
- **[`TESTING-PLAYBOOK.md`](./testing/TESTING-PLAYBOOK.md)**: Step-by-step guide for running unit, contract, frontend, and synthetic end-to-end tests.
- **[`FAILURE-AND-FIX-INDEX.md`](./testing/FAILURE-AND-FIX-INDEX.md)**: Verified log of engineering failure-and-fix pairs across all testing rounds.
- **[`CLASSIFIER-TEST-SUITE.md`](./testing/CLASSIFIER-TEST-SUITE.md)**: Test cases and boundary benchmarks for the Class A vs Class B intent classifier.
- **[`DOCUMENT-IMPROVEMENT-RELEASE-GATES.md`](./testing/DOCUMENT-IMPROVEMENT-RELEASE-GATES.md)**: Quality gates required before document extraction improvements can be merged.

### 5. [`submission/`](./submission/) — Hackathon Submission & Judge Materials
- **[`JUDGE-WALKTHROUGH.md`](./submission/JUDGE-WALKTHROUGH.md)**: Guided walkthrough for judges to independently verify claims and architecture.
- **[`SAARTHI-submission-2026-10-05.pptx`](./submission/SAARTHI-submission-2026-10-05.pptx)**: Final submission slide deck.
- **[`INDEPENDENT-EVALUATION-RUNBOOK.md`](./submission/INDEPENDENT-EVALUATION-RUNBOOK.md)**: Runbook for evaluators running tests in clean environments.
- **[`RELEASE-GATES-2026-10-05.md`](./submission/RELEASE-GATES-2026-10-05.md)**: Release gate signoff criteria.

### 6. [`compliance/`](./compliance/) — Licensing & Ethics
- **[`DATASET-LICENCES.md`](./compliance/DATASET-LICENCES.md)**: Dataset and third-party reference licenses, real-patient dignity statement, and synthetic data provenance.

### 7. [`project/`](./project/) — Overview & Scope
- **[`PROJECT-OVERVIEW.md`](./project/PROJECT-OVERVIEW.md)**: High-level summary of the SAARTHI project, mission, and technical architecture.
- **[`COMPLETENESS-MAP.md`](./project/COMPLETENESS-MAP.md)**: Component-by-component implementation status (`built`, `partial`, `designed-only`).

### 8. [`history/`](./history/) — Baselines & Execution Logs
- **[`WORKSPACE-BASELINE-2026-09-30.md`](./history/WORKSPACE-BASELINE-2026-09-30.md)**: Snapshot baseline of repository assets as of 30 Sept 2026.
- **[`WORKSPACE-RECONCILIATION-2026-09-30.md`](./history/WORKSPACE-RECONCILIATION-2026-09-30.md)**: Reconciliation record resolving duplicate or conflicting files.
