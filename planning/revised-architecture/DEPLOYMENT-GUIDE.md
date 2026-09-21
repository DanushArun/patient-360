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
EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/<BRANCH>/src/sql/setup.sql;
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
| 6 | Create 25 tables | The actual data model (patients, documents, events, rules, evidence) | No security applied yet. |
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

`setup.sql` is a thin top-level file that runs each phase's own file. This matches the HLD in `ARCHITECTURE-DIAGRAMS.md` §5b and the LLD in `SPEC.md` §2–§13.

```
patient-360/
├── src/
│   ├── sql/
│   │   ├── setup.sql                       ← entry point (idempotent, calls the 21 files below)
│   │   ├── teardown.sql                    ← rehearsal cleanup only
│   │   ├── 01_cortex_cross_region.sql      ← phase 1
│   │   ├── 02_warehouse.sql                ← phase 2
│   │   ├── 03_database_and_schemas.sql     ← phase 3
│   │   ├── 04_roles.sql                    ← phase 4
│   │   ├── 05_stages.sql                   ← phase 5
│   │   ├── 06_tables.sql                   ← phase 6   (25 tables — see SPEC.md §2)
│   │   ├── 07_policies.sql                 ← phase 7
│   │   ├── 08_attach_policies.sql          ← phase 8
│   │   ├── 09_grants.sql                   ← phase 9
│   │   ├── 10_ontology_and_units.sql       ← phase 10  (SPEC.md §2.7)
│   │   ├── 11_rules.sql                    ← phase 11  (SPEC.md §4.3 — 16 rules)
│   │   ├── 12_load_data.sql                ← phase 12  (SPEC.md §9 — synthetic generator output)
│   │   ├── 13_streams.sql                  ← phase 13
│   │   ├── 14_procedures.sql               ← phase 14  (SPEC.md §6 — 8 tools + 3 helpers)
│   │   ├── 15_dynamic_tables.sql           ← phase 15  (SPEC.md §13)
│   │   ├── 16_tasks.sql                    ← phase 16  (SPEC.md §11)
│   │   ├── 17_search_services.sql          ← phase 17  (SPEC.md §5)
│   │   ├── 18_semantic_view.sql            ← phase 18  (SPEC.md §8)
│   │   ├── 19_agent_and_skills.sql         ← phase 19  (SPEC.md §11)
│   │   ├── 20_streamlit.sql                ← phase 20  (SPEC.md §10 — 6 screens)
│   │   └── 21_notifications.sql            ← phase 21
│   └── streamlit/
│       ├── main.py                          ← runs USE SECONDARY ROLES NONE on start
│       ├── screens/                         ← 6 screens (SPEC.md §10)
│       └── skills/                          ← 4 SKILL.md files, uploaded to @SKILLS
├── data/
│   ├── fixtures/                            ← synthetic patient CSVs
│   ├── generator/                           ← SPEC.md §9 (12 corruption scenarios)
│   └── synthetic_docs/                      ← synthetic PDFs and FHIR bundles
├── tests/
│   ├── security/                            ← policy + consent + scope-leakage
│   ├── rules/                               ← 16 rules × 5 cases = 80 assertions
│   ├── eval/                                ← 40 dev + 40 held-out questions (SPEC.md §14)
│   └── e2e/                                 ← full ingest → cited answer flow
├── evidence/coco/                           ← query IDs, verification runs
├── planning/                                ← architecture + this doc
└── IMPLEMENTATION-STATUS.md                 ← honest build state
```

### Build order (matches the deploy order on purpose)

You build the same way the script deploys. Each phase group ends with its own tests before the next starts.

| Group | Files to author | Done when |
|---|---|---|
| A. Foundations | `01`–`04` | Warehouse, DB, 7 schemas, 5 roles exist. |
| B. Storage | `05`, `06` | 3 SSE stages + 25 tables created. |
| C. Security | `07`–`09` | Cross-user query returns nothing. |
| D. Reference | `10`, `11` | Ontology, units, 16 rules loaded. |
| E. Data | `12` + `data/generator/` | One synthetic patient flows end to end. |
| F. Pipeline | `13`–`16` | Streams fire, procs work, DTs refresh, tasks succeed. |
| G. Retrieval + agent | `17`–`19` | Both search services healthy, agent answers with citations. |
| H. UI + notify | `20`, `21` | Streamlit opens; notification integration created. |
| I. Tests | `tests/**` | 80 rule assertions + security suite + eval set pass. |
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
