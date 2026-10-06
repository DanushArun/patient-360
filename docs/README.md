# Saarthi documentation

Start with [`../README.md`](../README.md), then [`submission/JUDGE-WALKTHROUGH.md`](./submission/JUDGE-WALKTHROUGH.md)
for a guided reading path. [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md) marks every component
`built`, `partial` or `designed-only`.

| Directory | What it holds |
|---|---|
| [`architecture/`](./architecture/) | The specification (`SPEC.md`), AI integration, copilot spec, contracts, decision records, design reviews, deployment guide and diagrams |
| [`research/`](./research/) | Clinical, legal, platform and patient-reality research the design is grounded in |
| [`clinical/`](./clinical/) | Plain-language explanation of the 16 readiness rules |
| [`design/`](./design/) | Interface guidelines, design system, copilot experience, screen inventory |
| [`platform/`](./platform/) | Verified Snowflake behaviour, cost controls, MCP quickstart |
| [`testing/`](./testing/) | Testing playbook, classifier suite, release gates, failure-and-fix index |
| [`compliance/`](./compliance/) | Dataset licences and the real-report research statement |
| [`SUPERVISOR-CAPABILITIES.md`](./SUPERVISOR-CAPABILITIES.md) | What the copilot can do across every dashboard surface |
| [`project/`](./project/) | Project overview and completeness map |
| [`submission/`](./submission/) | Judge walkthrough, architecture and impact statement, deck, independent evaluation runbook |

The problem statement as published by the organisers is in [`PROBLEM-STATEMENT.md`](./PROBLEM-STATEMENT.md).

## architecture/

- [`SPEC.md`](./architecture/SPEC.md): the governing specification and rules R1–R7.
- [`AI-INTEGRATION-ARCHITECTURE.md`](./architecture/AI-INTEGRATION-ARCHITECTURE.md): where AI is used, model choice, two-pass extraction.
- [`COPILOT-SPEC.md`](./architecture/COPILOT-SPEC.md): the copilot's tools, answer shape and refusal boundary.
- [`ARCHITECTURE-HANDOFF.md`](./architecture/ARCHITECTURE-HANDOFF.md): the frozen contracts between data, rules and UI.
- [`ARCHITECTURE-DIAGRAMS.md`](./architecture/ARCHITECTURE-DIAGRAMS.md) and [`diagrams/`](./architecture/diagrams/): system, data, security and identity diagrams.
- [`DEPLOYMENT-GUIDE.md`](./architecture/DEPLOYMENT-GUIDE.md): deploy order on Snowflake.
- `DECISION-*.md`: decision records. `SPEC-REVIEW.md`, `SCALE-REVIEW.md`, `DEEP-REVIEW-3.md`, `FINAL-VALIDATION.md`: the design reviews the specification absorbed.
- [`WORK-PLAN.md`](./architecture/WORK-PLAN.md): the build plan and per-component acceptance tests cited throughout the code.

## research/

- `clinical/`: thresholds, FHIR mapping, lab reporting, PM-JAY, IRDAI/NHCX, ABDM, treatment timelines.
- `law/`: DPDP, NMC telemedicine guidelines, CDSCO software-as-device, medical records.
- `platform/`: verified Snowflake behaviour and implementation patterns.
- `patient-reality/`: clinician and patient experience research.
- `implementation/`: citation, polarity-checking and data-artifact design notes.
- `oncology-department-map.md`, `health-system-workflow-landscape.md`, `open-source-hospital-workflow-code-review.md`, `reference-corpus-sources.md`.
