# SAARTHI — Snowflake Deployment Guide

**Who this is for:** anyone deploying SAARTHI, even if you have never used Snowflake before.
**Rule of thumb:** one Git commit + one SQL script = one deployment. Nothing manual.

---

## 1. What "deploying" means here

Most apps you have seen work like this: you build a Docker image, push it to Kubernetes, and pods start running. SAARTHI is different. The whole application — the database, the security rules, the pipeline, the AI agent, the Streamlit screens — **runs inside Snowflake itself**. There is no separate server anywhere.

So "deploying" is very simple:

1. Snowflake reads a SQL script from this Git repository.
2. The script creates every object — tables, roles, policies, tasks, agent, app — in the right order.
3. Tests confirm the pipeline works and no one can see another patient's data.

The Git commit is your release artifact. Not a container image. A commit.

---

## 2. How Snowflake reads the repo (this is the pipeline part)

Snowflake has a built-in feature called a **Git repository object**. Think of it as Snowflake bookmarking your GitHub repo. Once an admin sets it up (one time, ever), Snowflake can pull any file from any branch or tag.

The command your CI/CD tool (Spinnaker, GitHub Actions, GitLab, whatever) runs looks like this:

```sql
EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/<BRANCH>/backend/sql/setup.sql;
```

**`<BRANCH>` is a variable, not a fixed word.** Your pipeline fills it in at run time:

- Deploy to a feature environment → `branches/feature-add-kidney-rule`
- Deploy to test → `branches/main`
- Deploy to production → `tags/v1.4.0` (a tagged release, not a moving branch)

Same script. Different pointer. That is the entire deployment pipeline.

```
GitHub commit ──▶ CI tool decides which ref to deploy ──▶ Snowflake pulls that ref
                                                             │
                                                             ▼
                                                 setup.sql runs top-to-bottom
                                                             │
                                                             ▼
                                                 Every SAARTHI object exists
```

The one rule: `setup.sql` must be **idempotent**. Plain meaning — running it twice must not break anything. Second run just leaves the account in the same correct state.

---

## 3. The 21 build phases (the shape of `setup.sql`)

This list is the same order shown in `ARCHITECTURE-DIAGRAMS.md` §5b and `SPEC.md` §14. Each row is one section of the script.

Symbols: **[!]** = if you get this wrong, security silently breaks. **[AI]** = uses Cortex AI.

| # | Phase | In plain words | Why the order matters |
|---:|---|---|---|
| 1 | **[!]** Turn on cross-region Cortex AI | Tell Snowflake it may reach AI models in other regions | Our region has no local AI. Without this, every AI call fails. |
| 2 | Create the warehouse (`SAARTHI_AI_WH`) | The engine that runs queries and AI | Search services attach to a warehouse at creation. It must exist first. |
| 3 | Create the database + 7 schemas | Folders that hold everything: `CORE`, `DOCUMENTS`, `EVIDENCE`, `OPERATIONAL`, `GOVERNANCE`, `STAGES`, `EVAL` | Every later object lives in one of these folders. |
| 4 | Create 5 roles | Login groups: admin, app user, judge, etc. | Grants and policies reference roles by name. |
| 5 | **[!]** Create 3 file stages | Buckets inside Snowflake for PDFs, FHIR bundles, agent skill files | AI functions only read stages with `SNOWFLAKE_SSE` encryption. Any other type silently fails later. |
| 6 | Create 34 tables | The actual data model (patients, documents, events, rules, evidence) | No security applied yet. |
| 7 | **[!]** Create the row-access policy + 2 masking policies | The rules that decide who sees which patient row | Must key on `CURRENT_USER()`. Not `CURRENT_ROLE()`. A role-based rule leaks every patient inside a procedure. |
| 8 | **[!]** Attach the row-access policy to `DOC_PAGE` only | Turn on protection on the right table | Cortex Search cannot be built over a protected table. So `DOC_CHUNK` (what search reads) has none; the real content sits behind `DOC_PAGE`. |
| 9 | **[!]** Grant permissions | Tell each role exactly what it may touch | App role must get **no** direct access to search services. Sessions must run `USE SECONDARY ROLES NONE`. Otherwise an admin's extra roles bypass all rules. |
| 10 | Load clinical vocabulary + unit conversions | Reference tables that normalise `Hb`, `mg/dL`, etc. | Dynamic tables (step 15) read these to standardise values. |
| 11 | Load 16 clinical rules | The readiness rules (kidney function, ANC, etc.) | Each has a guideline reference and version. |
| 12 | Load synthetic data | Sample CSVs, FHIR bundles, PDFs — all fake | Only synthetic. Never real patient data. Ontology (step 10) must already exist. |
| 13 | Create 3 change-tracking streams | Watchers that notice when new files or rows arrive | The pipeline reacts to changes automatically. |
| 14 | Create 11 procedures | The safe "windows" the app looks through — patient data never touched directly | Every procedure re-checks who the user is and what consent allows. |
| 15 | Create 5 dynamic tables | Auto-refreshing calculated tables (harmonised events, chunks, review queue, eligibility, plan) | Deterministic only — no AI here. |
| 16 | **[AI]** Create 6 tasks | Scheduled jobs. The **only** place AI runs: parse, flatten, extract, reconcile, refresh readiness, notify | AI cannot run inside dynamic tables. Tasks are the AI's home. |
| 17 | **[AI]** Create 2 Cortex Search services | Search indexes: one for patient documents, one for public reference material | They are kept separate on purpose so the AI never mixes them. |
| 18 | Create the semantic view + 6 verified queries | A curated set of allowed cohort questions | The agent runs these, not free-form SQL. |
| 19 | **[AI]** Create the agent + 4 skill files | The clinical copilot itself | Deployed last so it cannot be used before every safety layer exists. |
| 20 | Create the Streamlit app | The web UI clinicians actually see | Session must run `USE SECONDARY ROLES NONE` on start. |
| 21 | Create the notification integration | Email + webhook channel for alerts | Used by the notify task when a visit is 1–3 days away. |

**The five things that must not change**

1. Line 1 is the cross-region Cortex switch.
2. Every stage is `SNOWFLAKE_SSE` encrypted.
3. The row-access policy keys on `CURRENT_USER()`.
4. `DOC_CHUNK` stays unprotected; `DOC_PAGE` is protected.
5. Every session runs `USE SECONDARY ROLES NONE`.

Break any of these and single-user testing looks perfect while cross-patient leakage is live.

---

## 4. Repository layout (implementation)

**Revised 21 Sept — this section originally proposed `src/sql/` with one file per numbered phase. It was superseded the same day: everything that runs inside Snowflake (plus the tooling that deploys and tests it) lives under `backend/`, and the Streamlit client is `frontend/` — with one file per *procedure* rather than one file per deploy phase, so two people editing different tool procedures never touch the same file. `setup.sql` still contains no DDL — it is a list of `EXECUTE IMMEDIATE FROM` lines in build order, one per file below, which is where the 21-phase shape from §3 actually lives. `planning/builder-1/REPO-STRUCTURE.md` §2 has the full rationale; treat it as authoritative over this tree if the two ever disagree.**

```
patient-360/
├── backend/
│   ├── sql/
│   │   ├── setup.sql                       ← entry point (idempotent; EXECUTE IMMEDIATE FROM, in build order)
│   │   ├── teardown.sql                    ← rehearsal cleanup only
│   │   ├── account/                        ← phases 1–5: cross-region, warehouse, db+schemas, roles, stages
│   │   ├── tables/                         ← phase 6 (34 tables — SPEC.md §2)
│   │   ├── governance/                     ← phases 7–9: policies, attach policies, grants
│   │   ├── data/                           ← phases 10–12: ontology, unit registry, rules, synthetic load
│   │   ├── streams/                        ← phase 13
│   │   ├── procedures/                     ← phase 14 — one file per procedure (SPEC.md §6)
│   │   │   └── tools/                      ← the 8 agent tools, one file each, plus a shared _preamble.sql
│   │   ├── dynamic_tables/                 ← phase 15 (SPEC.md §13)
│   │   ├── tasks/                          ← phase 16 (SPEC.md §11)
│   │   ├── search/                         ← phase 17 (SPEC.md §5) — two services, physically separate
│   │   ├── semantic/                       ← phase 18 (SPEC.md §8)
│   │   ├── agent/                          ← phase 19 (SPEC.md §11)
│   │   ├── integrations/                   ← phase 21 — notifications, git repository
│   │   ├── prompts/                        ← R7 pass A/B prompt strings, versioned via CHANGELOG.md
│   │   ├── probes/                         ← NOT deployed — model_availability.sql, output is evidence
│   │   └── stubs/                          ← TEMPORARY, deleted at the Day-5 gate
│   ├── scripts/                            ← check_gate.py (5 mechanical checks), deploy.sh (local inner loop)
│   ├── skills/                             ← 4 SKILL.md, stage-mounted
│   ├── eval/                               ← questions, ground truth, harness, results
│   └── tests/                              ← SQL suites (run via the Snowflake CLI) + generator/ (plain pytest)
├── frontend/                               ← the Streamlit client — no business logic; that's all in backend/sql/
│   ├── streamlit_app.py                    ← entry point (phase 20). Session runs USE SECONDARY ROLES NONE.
│   ├── contracts/                          ← FROZEN: answer_schema.json, error_shape.json, tool_signatures.yaml
│   ├── pages/ · components/ · core/ · fixtures/ · tests/
├── data/
│   ├── generator/                          ← ledger.py → projections.py → fhir_bundles.py → documents.py →
│   │                                          corruptions.py → eval_questions.py (SPEC.md §9)
│   ├── fixtures/                           ← generated synthetic data
│   └── synthetic_docs/                     ← synthetic PDFs and FHIR bundles
├── evidence/coco/                          ← query IDs, verification runs
├── docs/architecture/                       ← architecture + this doc
└── IMPLEMENTATION-STATUS.md                 ← honest build state
```

### Build order (matches the deploy order on purpose)

You build the same way the script deploys. Each phase group ends with its own tests before the next starts.

| Group | `backend/sql/` files | Done when |
|---|---|---|
| A. Foundations | `account/` | Warehouse, DB, 7 schemas, 5 roles exist. |
| B. Storage | `account/05_stages.sql`, `tables/` | 3 SSE stages + 34 tables created. |
| C. Security | `governance/` | Cross-user query returns nothing. |
| D. Reference | `data/ontology.sql`, `data/rules.sql` | Ontology, units, 16 rules loaded. |
| E. Data | `data/load_synthetic.sql` + `data/generator/` | One synthetic patient flows end to end. |
| F. Pipeline | `streams/`, `procedures/`, `dynamic_tables/`, `tasks/` | Streams fire, procs work, DTs refresh, tasks succeed. |
| G. Retrieval + agent | `search/`, `semantic/`, `agent/` | Both search services healthy, agent answers with citations. |
| H. UI + notify | `frontend/streamlit_app.py`, `integrations/` | Streamlit opens; notification integration created. |
| I. Tests | `backend/tests/**` | 80 rule assertions + security suite + eval set pass. |
| J. Clean-account rehearsal | — | Same commit deploys to an empty account with zero manual fixes. |

---

## 5. Release gate — you are done when

- The script rerun on a **clean, empty account** completes without any manual fix.
- One synthetic patient flows through ingest → readiness → cited answer in the app.
- A user who is not on the patient's care team gets nothing back.
- Revoking consent blocks the very next query — no cache leak.
- Direct search-service access as the app role is denied.
- All 80 rule assertions pass and the held-out eval hits the targets in `SPEC.md` §14.

If those six things are true on a clean account, deployment is real.

---

## Related documents

- `SPEC.md` §14 — deployment scope and evaluation gates
- `ARCHITECTURE-DIAGRAMS.md` §5 — visual dependency graph for the 21 phases
- `ARCHITECTURE-HANDOFF.md` §3 — the three build streams
- `IMPLEMENTATION-STATUS.md` — current build state, updated per day
