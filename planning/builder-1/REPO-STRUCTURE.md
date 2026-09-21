# SAARTHI — Repository Structure

**The physical layout of the build, derived from Builder 1's task list in `WORK-PLAN.md`.**

Every path that `WORK-PLAN.md` names exists here unchanged. Everything else was added to hold objects the plan requires but never gave a home. Ownership is marked per directory, because **two people, one repo, seventeen days** — path-level ownership is what keeps integration from becoming merge archaeology.

| Mark | Meaning |
|---|---|
| `[1]` | Builder 1 writes it. Builder 2 reads it. |
| `[2]` | Builder 2 writes it. Builder 1 reads it. |
| `[·]` | Shared. Append-only conventions below. |

**Revised 21 Sept:** `sql/` moved to `backend/sql/`, `scripts/`, `skills/`, `eval/`, and the top-level `tests/` moved under `backend/` alongside it — everything that executes inside Snowflake, plus the tooling that deploys and tests it, now lives under one `backend/` root. `app/` was renamed `frontend/` to pair with it cleanly: it is the Streamlit client, and carries no business logic of its own — the rule engine, R7 extraction, the agent, and every consent/scope check run server-side in `backend/sql/`. `data/`, `evidence/`, and `planning/` stay at repo root. The tree below reflects that move; §4 records why.

---

## 1. The tree

```
patient-360/
│
├── AGENTS.md                            [·]  R1–R7 + 10 platform facts. Read every session.
├── README.md                            [1]  Day 16. A stranger deploys from this.
├── IMPLEMENTATION-STATUS.md             [·]  Every row honest. Updated the day a thing is built.
├── requirements.txt                     [·]  Local dev only.
│
├── backend/                             ←  everything that runs inside Snowflake, plus its tooling
│   │
│   ├── sql/                             ←  every Snowflake object. Order is explicit.
│   │   ├── setup.sql                    [2]  COMPOSITION ONLY — EXECUTE IMMEDIATE FROM, in build order
│   │   ├── teardown.sql                 [2]  DROP DATABASE + warehouse + roles
│   │   │
│   │   ├── account/                     [2]  build steps 1–5
│   │   │   ├── 01_cross_region.sql           ALTER ACCOUNT … ANY_REGION  ← line one, always
│   │   │   ├── 02_warehouse.sql               SAARTHI_AI_WH, SMALL, 60s
│   │   │   ├── 03_database_schemas.sql        SAARTHI + 7 schemas
│   │   │   ├── 04_roles.sql                   5 roles
│   │   │   └── 05_stages.sql                  SNOWFLAKE_SSE + DIRECTORY on all three
│   │   │
│   │   ├── tables/                      [2]  step 6
│   │   │   ├── 10_governance.sql              ORGANIZATION … SECURITY_EVENT
│   │   │   ├── 20_core.sql                    PATIENT … TREATMENT_PLAN
│   │   │   ├── 30_documents.sql               DOCUMENT · DOC_PAGE · DOC_CHUNK · RAW_FHIR_BUNDLE
│   │   │   ├── 40_evidence.sql                ASSERTION · EVIDENCE_LINK · ANSWER_RUN
│   │   │   └── 50_operational.sql             RULE · READINESS_STATE · REVIEW_TASK · ontology · units
│   │   │
│   │   ├── governance/                  [2]  steps 7–9 — the red steps
│   │   │   ├── 01_policies.sql                RAP on CURRENT_USER() · 2 masking · 1 tag
│   │   │   ├── 02_attach_policies.sql         DOC_PAGE yes. DOC_CHUNK never (F4).
│   │   │   └── 03_grants.sql                  app role gets no USAGE on search services (F7)
│   │   │
│   │   ├── data/                        [2]  steps 10–12
│   │   │   └── ontology.sql · unit_registry.sql · rules.sql · load_synthetic.sql
│   │   │
│   │   ├── streams/                     [2]  step 13
│   │   ├── dynamic_tables/              [2]  step 15
│   │   ├── search/                      [2]  step 17 — two services, physically separate
│   │   ├── semantic/                    [2]  step 18 — semantic view + 6 VQRs
│   │   ├── integrations/                [2]  step 21 — notifications, git repository
│   │   │
│   │   ├── procedures/                  ←  SPLIT OWNERSHIP. One file per procedure, no exceptions.
│   │   │   ├── bind_patient.sql         [2]  governance-owned; Builder 1 is its first consumer
│   │   │   ├── evaluate_gates.sql       [2]  the engine. Builder 1 never reimplements this.
│   │   │   ├── classify_question.sql    [1]  Class A/B. Upstream of the agent, not a tool.
│   │   │   ├── validate_answer.sql      [1]  6 checks, fail closed
│   │   │   └── tools/                   [1]  the 8 agent tools, one file each
│   │   │       ├── _preamble.sql              the bind→authorise→consent block every tool opens with
│   │   │       ├── 01_get_patient_facts.sql
│   │   │       ├── 02_get_readiness.sql
│   │   │       ├── 03_search_patient_documents.sql
│   │   │       ├── 04_search_reference_documents.sql
│   │   │       ├── 05_cohort_query.sql
│   │   │       ├── 06_get_timeline.sql
│   │   │       ├── 07_get_changes.sql
│   │   │       └── 08_create_review_task.sql
│   │   │
│   │   ├── tasks/                       ←  SPLIT OWNERSHIP
│   │   │   ├── parse_documents.sql      [2]  AI_PARSE_DOCUMENT + SHA-256 dedup
│   │   │   ├── flatten_fhir.sql         [2]  LATERAL FLATTEN
│   │   │   ├── extract_assertions.sql   [1]  R7 two-pass
│   │   │   ├── reconcile_evidence.sql   [1]  discordance + supersession
│   │   │   ├── refresh_readiness.sql    [2]  5-minute schedule
│   │   │   ├── notify.sql               [2]  blocker + days_to_visit ≤ 3
│   │   │   └── orchestrator.sql         [1]  TASK_SAARTHI_ORCHESTRATOR chains the 4 skills
│   │   │
│   │   ├── prompts/                     [1]  every prompt string, versioned
│   │   │   ├── CHANGELOG.md                   editing a prompt bumps ASSERTION.extractor_version
│   │   │   ├── pass_a_lab.md · pass_a_pathology.md · pass_a_imaging.md
│   │   │   ├── pass_a_discharge.md · pass_a_claim.md
│   │   │   └── pass_b_verify.md
│   │   │
│   │   ├── probes/                      [1]  NOT deployed. Output is evidence.
│   │   │   └── model_availability.sql         Day 1, before any extraction work
│   │   │
│   │   ├── agent/                       [1]  step 19
│   │   │   ├── saarthi_agent.sql              orchestration PINNED · 8 generic tools · 4 skills
│   │   │   └── saarthi_mcp.sql                2 read-only tools, no patient-scoped tool
│   │   │
│   │   └── stubs/                       [1]  TEMPORARY. Deleted at the Day-5 gate.
│   │       ├── README.md                      says loudly that nothing here ships
│   │       └── stub_tools.sql                 signature-identical, fixture-backed
│   │
│   ├── scripts/                         [·]
│   │   ├── check_gate.py                     5 mechanical checks. Run before every merge.
│   │   └── deploy.sh                          parses setup.sql, runs each step, resumes on failure
│   │
│   ├── skills/                          [1]  4 SKILL.md, stage-mounted
│   │   ├── clinical-question-routing/SKILL.md
│   │   ├── evidence-retrieval/SKILL.md
│   │   ├── risk-stratification/SKILL.md
│   │   ├── evidence-reconciliation/SKILL.md
│   │   ├── upload_skills.sql                  COPY INTO @STAGES.SKILLS — no local PUT
│   │   └── reuse-tests/                       second synthetic schema + the ambiguity it refuses
│   │
│   ├── eval/                            [1]
│   │   ├── questions/dev_40.jsonl · heldout_40.jsonl
│   │   ├── ground_truth/                      loaded into EVAL schema. App role cannot read it.
│   │   ├── harness/
│   │   │   ├── native_eval.sql                EXECUTE_AI_EVALUATION — GPA metrics
│   │   │   ├── run_eval.py                    our four non-native metrics
│   │   │   └── baseline_rag.py                the delta we report in both directions
│   │   ├── adversarial/                       cross-scope leakage = 0. A security property.
│   │   └── results/                           machine-readable, committed
│   │
│   └── tests/                           ←  SPLIT OWNERSHIP. SQL suites run through the Snowflake CLI;
│       │                                     generator/ is plain pytest, no Snowflake needed.
│       ├── sql/rules/                   [2]  16 rules × 4 outcomes
│       ├── sql/access/                  [1]  one negative test per tool procedure
│       ├── sql/extraction/              [1]  the ambiguous CBC page → conflicting
│       ├── sql/validator/               [1]  6 tests, one per check, each making it fire
│       ├── generator/                   [2]  pytest for data/generator/*.py — built, 39 tests
│       ├── run_tests.py                 [·]
│       └── TEST-MANIFEST.md             [·]  every test named, 36 and counting
│
├── frontend/                            [1]  the copilot. Streamlit + Python. No business logic here —
│   │                                          every rule, gate and consent check runs in backend/sql/.
│   ├── streamlit_app.py                       entry point. Session hardening on first run.
│   ├── contracts/                       ←  FROZEN. Changing one means telling Builder 2 first.
│   │   ├── answer_schema.json                 Contract 3. Committed Day 1, before anything else.
│   │   ├── error_shape.json                   the 5-value uniform error envelope
│   │   └── tool_signatures.yaml                Contract 2. The agent YAML is generated from this.
│   ├── pages/
│   │   ├── 1_Ask_and_Evidence.py              ⭐ the deliverable
│   │   ├── 2_Review_Queue.py
│   │   ├── 3_Patient_360.py
│   │   ├── 4_Review_and_History.py
│   │   ├── 5_Navigator_View.py
│   │   └── 6_Judge_Console.py                 8 probes, each showing SQL and result
│   ├── components/
│   │   ├── binding_header.py                  persistent. Shows who the answer is about.
│   │   ├── patient_picker.py                  care-team-filtered list. The only way to select.
│   │   ├── answer_view.py                     per-claim rendering
│   │   ├── evidence_pane.py                   dispatches on evidence.kind — three renderings
│   │   ├── gate_strip.py                      4 outcomes, never a boolean
│   │   ├── refusal.py                         Class A + evidence packet offer, practitioner named
│   │   └── provenance.py                      rule id + version + provenance_note badge
│   ├── core/
│   │   ├── session.py                         USE SECONDARY ROLES NONE · CURRENT_USER() probe (U2)
│   │   ├── binding.py                         bind · release · switch → clears history
│   │   ├── conversation.py                    6 turns. Tool output never replayed.
│   │   ├── agent_client.py                    DATA_AGENT_RUN + one reparse + fallback
│   │   ├── router.py                          deterministic fallback over the same 8 procedures
│   │   ├── tools.py                           typed wrappers. No function here takes a patient id.
│   │   ├── contracts.py                       loads answer_schema.json, validates every answer — built
│   │   └── errors.py                          maps the 12 named behaviours (5 error codes + 7 fallback) — built
│   ├── fixtures/                               Day-1 UI is built entirely against these
│   │   ├── answer_supported.json · answer_conflicting.json · answer_class_a.json
│   │   ├── answer_partial.json · readiness_four_outcomes.json
│   │   └── page_DOC-0031_p2.json               fixture page text so the evidence pane can open
│   ├── environment.yml                        Streamlit-in-Snowflake package manifest
│   └── tests/
│       ├── test_contracts.py                  11 tests, TDD, confirmed red before contracts.py existed
│       └── test_errors.py                     10 tests, TDD, confirmed red before errors.py existed
│
├── data/generator/                      [2]  ledger.py · projections.py · fhir_bundles.py · documents.py — built,
│                                              see IMPLEMENTATION-STATUS.md for current detail, this tree drifts
├── evidence/coco/                       [·]  verification-query-ids.md is append-only
├── planning/                            [·]  unchanged. builder-1/ is this handoff.
└── tools/drawio/                        [·]  diagram generator, existing
```

**The tree exists.** Directories are created, the contracts are written and verified, and the gate runs. `planning/builder-1/README.md` lists exactly what is on disk versus what is still a `.gitkeep`.

---

## 2. Six structural decisions, and why

**`setup.sql` contains no DDL.** It is a list of `EXECUTE IMMEDIATE FROM '<file>'` lines in build order. Two people appending to one file conflict constantly; two people appending *one line each* to a file whose every line is independent almost never do. It also makes the build order in diagram 5b literally readable in one screen, which is what a judge will check first.

**One file per procedure.** `backend/sql/procedures/tools/` holding eight files instead of one means Builder 1 can be mid-edit on `03_search_patient_documents.sql` while Builder 2 patches `bind_patient.sql` with zero overlap. It also makes `CREATE OR REPLACE PROCEDURE` re-runnable per object during development — the fastest inner loop available on this platform.

**`_preamble.sql` is not shared code, it is a reviewed block.** Snowflake procedures have no include mechanism. Every tool opens with the same twelve lines: resolve the binding on `CURRENT_SESSION()`, re-validate `CARE_TEAM`, re-validate `CONSENT`, return the uniform error on any failure. Keeping the canonical copy in one file and pasting it into eight procedures is worse engineering and better security than abstracting it — a reviewer can diff eight copies against one reference and see that none of them skipped the consent check. **Make the diff part of the Day-5 integration check.**

**Prompts live in `backend/sql/prompts/` as markdown, not inline in the task.** `ASSERTION.extractor_version` is supposed to version the extractor, and a version number that nobody bumps is a lie in the audit trail. A directory with a `CHANGELOG.md` makes the bump a visible act. The task SQL carries the prompt as a string literal; the markdown file is the reviewed source of that literal, and the changelog line is what justifies the version number.

**Streamlit deploys from the Git repository, not from a fourth stage.** `CREATE STREAMLIT … ROOT_LOCATION = '@SAARTHI_REPO/branches/main/frontend'` uses the Git integration already in the object inventory. Adding an `APP_CODE` stage would make the honest stage count four while every diagram and `IMPLEMENTATION-STATUS.md` says three. Reuse the repository stage and the inventory stays true.

**`backend/sql/stubs/` exists so Builder 1 never waits, and has a deletion date.** Signature-identical procedures over fixture rows, created in a `STUB` schema, let the agent and the UI be built and tested before Builder 2's tables exist. The Day-5 gate includes a grep: **`setup.sql` must not reference `backend/sql/stubs/`, and the `STUB` schema must not exist on the clean-account deploy.** A stub that survives to submission is the "any answer is hard-coded" no-go condition.

---

## 2a. The gate — `backend/scripts/check_gate.py`

Five checks that turn promises in the architecture into build failures. Each exists because the failure it catches is **invisible by inspection** — that is the whole argument for the script.

| Check | Fails when | The failure it prevents |
|---|---|---|
| `--contracts` | a fixture stops validating, or the schema stops rejecting a malformed answer | a schema that has never rejected anything is decorative |
| `--params` | a forbidden parameter appears under `parameters:` in the contract or under `input_schema:` in the agent spec | **A1 regression.** Given a reachable parameter the agent fills it from the question text |
| `--preamble` | a tool procedure lacks the markers, or its block has drifted from the reference copy | one procedure quietly skipping the consent check |
| `--stubs` | `setup.sql` deploys a stub, or the `STUB` schema is referenced outside `backend/sql/stubs/` | *"any answer is hard-coded"* — a go/no-go failure nobody commits on purpose |
| `--manifest` | an active `EXECUTE IMMEDIATE FROM` line points at a file that does not exist | a deploy that only works on a machine with leftover state |
| `--models` | orchestration is `auto`, both R7 passes are Llama, or a `[legacy]` model appears in shipped code | **R7 verifying nothing.** Two models from one family produce correlated errors and identical-looking output |

```sh
backend/scripts/check_gate.py --all              # during the build: skips are expected
backend/scripts/check_gate.py --all --strict     # Day-5 gate onward: a skip is a failure
```

**It was tested by breaking things, not by passing on an empty repo.** A patient selector injected into an agent spec's `input_schema`, a preamble with one line edited out, a stub line added to the manifest, a manifest pointing at a missing file, and the original `llama3.3-70b` / `llama3.1-70b` pass pairing — all caught, and the agent spec's *prose* mentioning `patient_id` correctly did **not** false-positive.

**`--models` exists because that mistake was already made once.** The architecture described `llama3.1-70b` as a different family from `llama3.3-70b` for months. It is not, the output would have looked identical either way, and R7 is claim #1 of the five that win. A check is cheaper than remembering.

**The `--params` check has one deliberate blind spot, and it is correct.** `bind_patient` takes a `patient_id`, under `internal:` in the contract. That is the one place the parameter legitimately exists — it carries a human's click on a name in a care-team-filtered list, and the agent has no access to that procedure. The scan stops at the `internal:` boundary.

---

## 3. Conventions

| Thing | Convention |
|---|---|
| SQL file names | `NN_snake_case.sql`. The number is deploy order inside its directory, not a global sequence. |
| Object names | `UPPER_SNAKE`. Procedures `lower_snake` in the spec, created as `UPPER_SNAKE` — match `AI-INTEGRATION-ARCHITECTURE.md` §2 `tool_resources` exactly or the agent will not resolve them. |
| Idempotency | Every DDL file re-runnable. `CREATE OR REPLACE` for procedures, tasks, DTs, views. `CREATE … IF NOT EXISTS` for tables, stages, roles. Seed data uses `MERGE`, never bare `INSERT`. |
| Python | Standard library plus Snowpark and Streamlit. Anything else must exist in the Snowflake Anaconda channel — verify before depending on it. |
| Branches | `b1/<topic>` and `b2/<topic>`. Never straight to main. |
| Commits | **Danush commits. Agents never do.** `AGENTS.md` §1. |
| A contract change | Told to the other builder *before* the edit, not in the commit message. |

---

## 4. Repo-layout history — `src/sql/` and the `backend/` + `frontend/` move

`src/sql/001_database_and_schemas.sql` and `002_core_tables.sql` were v1 files that predated the revised architecture and contradicted it — `ENCOUNTER.facility` was a bare `VARCHAR`, the spec requires `facility_id` FK; six schemas existed where seven are needed; no `GOVERNANCE` tables at all. They have been **archived to `planning/archive/v1-src-sql/`**, not deleted, as planning-phase CoCo lifecycle evidence.

`AI-INTEGRATION-ARCHITECTURE.md` §8 once specified the Git deploy as `EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/main/src/sql/setup.sql`, which pointed at a path that never held the real `setup.sql`. That has been fixed.

**Then the layout moved again, 21 Sept:** every Snowflake-side folder (`sql/`, `scripts/`, `skills/`, `eval/`, the SQL-suite `tests/`) now lives under one `backend/` root, and `app/` was renamed `frontend/` to pair with it — `backend/` is everything that executes inside Snowflake plus the tooling that deploys and tests it; `frontend/` is the Streamlit client, carrying no business logic. The Git deploy path is now `EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/main/backend/sql/setup.sql`. Every reference in this document, in `WORK-PLAN.md`, `IMPLEMENTATION-STATUS.md`, `backend/scripts/check_gate.py`, `backend/scripts/deploy.sh`, and `backend/tests/run_tests.py` was updated to match, and `backend/scripts/check_gate.py --all` passes against the new layout.
