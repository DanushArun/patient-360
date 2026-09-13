# SAARTHI — Care Readiness & Evidence Copilot

**Goal:** Answer, with cited evidence and never an opaque prediction, whether a cancer patient is ready for their next step of care — clinically, documentationally, and financially — and exactly what is missing, so families don't take a 1,000+ km trip for nothing.

Built for the Snowflake CoCo CLI Hackathon 2026 (GCC Edition) — Problem Statement 04: Patient and Member 360 and Clinical or Regulatory Document Copilot. **Synthetic data only. No real patient information.**

## The 4 screens

1. **Review queue** — upcoming visits, review priority, unresolved issues, assigned owner
2. **Patient 360** — source IDs, dated diagnosis/pathology assertions, medication events, encounters, labs, claims/authorization status, documents and corrections
3. **Ask + evidence** — free-text questions, concise cited answers, evidence pane showing the exact passage or row, visible unknowns/discrepancies
4. **Review + history** — create/assign a documentation task, record status changes, source references, audit trail, export a versioned evidence packet

Full design rationale, architecture, data model, gates, and test plan: `planning/plan.md`.

## Decisions

- 2026-09-13: Repo created (`patient-360`), structure set up per team plan.
- 2026-09-13: Snowflake tech-stack smoke test — **pending** (Dev 1).
- 2026-09-13: Demo patient — **P-017**.

## Repo layout

- `data/generator/` — Python scripts generating synthetic patients and documents
- `data/fixtures/` — generated fake data (JSON/CSV/text), including `documents/`
- `sql/` — CREATE TABLE / load scripts for Snowflake
- `app/` — Streamlit application code
- `tests/` — test questions + expected answers, kept separate from `app/` so it can't read its own answer key
- `evidence/coco/` — CoCo session notes, screenshots, proof of how this was built
- `planning/` — this project's plan and any designer/flow exports

**Never commit real credentials.** Snowflake secrets go in a local `.env` (already git-ignored), never in code.
