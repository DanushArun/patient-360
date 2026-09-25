-- =============================================================================
-- SAARTHI - deployment manifest
-- =============================================================================
--
-- COMPOSITION ONLY. There is no DDL in this file and none may be added.
-- Every line below is one EXECUTE IMMEDIATE FROM, in the order of diagram 5b in
-- ARCHITECTURE-DIAGRAMS.md. Do not reorder: an object cannot be created before
-- everything it depends on exists, and three of the dependencies fail silently
-- rather than loudly.
--
-- WHY THIS FILE HOLDS NO DDL
--   Two people appending to one DDL file conflict constantly. Two people
--   appending one independent line each almost never do. It also means the
--   21-step build order is readable in one screen, which is the first thing a
--   judge checks and the first thing that goes wrong on a clean account.
--
-- HOW TO USE IT DURING THE BUILD
--   Every line starts commented out. Uncomment a line the moment its file
--   exists AND runs clean on its own. A commented line is skipped identically by
--   Snowflake and by backend/scripts/deploy.sh, so the manifest is the single source of
--   build order and of build progress. `backend/scripts/check_gate.py --manifest` fails
--   if an uncommented line points at a file that does not exist.
--
-- RUN IT
--   from the repository stage (the deploy path judges reproduce):
--       EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/main/backend/sql/setup.sql;
--   locally, during development:
--       backend/scripts/deploy.sh <connection-name>
--
-- IDEMPOTENCY
--   setup.sql must run clean on a fresh account, run clean a second time, run
--   after teardown.sql, and run clean a third time. CREATE OR REPLACE for
--   procedures, tasks, dynamic tables, views, agents. CREATE ... IF NOT EXISTS
--   for tables, stages, roles. MERGE for seed data, never a bare INSERT.
--
-- Owner: Builder 2, after this scaffold. Builder 1 uncomments the [1] lines.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- STEP 1 - Account parameter.  [2]
-- ---------------------------------------------------------------------------
-- GCP_ME_CENTRAL2 has NO local AI_COMPLETE endpoint. Without this, nothing in
-- the AI path runs and the failure surfaces somewhere unrelated. Line one.
-- Someone reproducing this on a fresh account fails immediately without it.
EXECUTE IMMEDIATE FROM './account/01_cross_region.sql';


-- ---------------------------------------------------------------------------
-- STEP 2 - Warehouse.  [2]
-- ---------------------------------------------------------------------------
-- SAARTHI_AI_WH, SMALL, AUTO_SUSPEND 60, INITIALLY_SUSPENDED TRUE.
-- Search services name a warehouse at creation time, so it must exist first.
EXECUTE IMMEDIATE FROM './account/02_warehouse.sql';


-- ---------------------------------------------------------------------------
-- STEP 3 - Database and 7 schemas.  [2]
-- ---------------------------------------------------------------------------
-- CORE - DOCUMENTS - EVIDENCE - OPERATIONAL - GOVERNANCE - STAGES - EVAL
-- EVAL is not optional: the eval truth key lives there and must be unreadable
-- by the app role, or the system can read its own answer key.
EXECUTE IMMEDIATE FROM './account/03_database_schemas.sql';


-- ---------------------------------------------------------------------------
-- STEP 4 - Roles.  [2]
-- ---------------------------------------------------------------------------
-- 5 roles. Policies and grants reference them by name, so they come first.
-- Name settled in planning/builder-1/README.md item 5.
EXECUTE IMMEDIATE FROM './account/04_roles.sql';


-- ---------------------------------------------------------------------------
-- STEP 5 - Stages.  [2]  *** RED STEP ***
-- ---------------------------------------------------------------------------
-- PATIENT_DOCS - REFERENCE_DOCS - SKILLS
-- ALL THREE: ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE') and DIRECTORY = (ENABLE = TRUE).
-- F9: AI functions cannot read SNOWFLAKE_FULL, user stages (@~) or table stages.
-- Wrong encryption fails at PARSE time, not at CREATE time - days later, in a
-- different file, with an unrelated-looking error.
EXECUTE IMMEDIATE FROM './account/05_stages.sql';


-- ---------------------------------------------------------------------------
-- STEP 6 - Tables.  [2]
-- ---------------------------------------------------------------------------
-- No policies attached yet. SPEC.md 2, diagrams 9 and 10.
-- Table names are Contract 1 and Builder 1's procedures read them literally.
EXECUTE IMMEDIATE FROM './tables/10_governance.sql';
EXECUTE IMMEDIATE FROM './tables/20_core.sql';
EXECUTE IMMEDIATE FROM './tables/30_documents.sql';
EXECUTE IMMEDIATE FROM './tables/40_evidence.sql';
EXECUTE IMMEDIATE FROM './tables/50_operational.sql';


-- ---------------------------------------------------------------------------
-- STEP 7 - Policies.  [2]  *** RED STEP ***
-- ---------------------------------------------------------------------------
-- 1 row access policy + 2 masking policies + 1 sensitivity tag.
-- F3: the RAP keys on CURRENT_USER(), NEVER CURRENT_ROLE(). Inside an
-- EXECUTE AS OWNER procedure CURRENT_ROLE() becomes the OWNER's role, so a
-- role-keyed policy returns every patient - a total bypass that looks perfect
-- in single-user testing because the owner is the caller.
EXECUTE IMMEDIATE FROM './governance/01_policies.sql';


-- ---------------------------------------------------------------------------
-- STEP 8 - Attach policies.  [2]  *** RED STEP ***
-- ---------------------------------------------------------------------------
-- DOC_PAGE gets the row access policy. DOC_CHUNK gets NONE.
-- F4: CREATE CORTEX SEARCH SERVICE fails with "Change tracking is not supported
-- on queries with correlated subquery expressions" over a RAP-protected table.
-- The index holds no content and returns IDs; content lives behind the policy.
-- The platform forced the correct security architecture. Do not "fix" this.
EXECUTE IMMEDIATE FROM './governance/02_attach_policies.sql';


-- ---------------------------------------------------------------------------
-- STEP 9 - Grants.  [2]  *** RED STEP ***
-- ---------------------------------------------------------------------------
-- The app role gets NO USAGE on either search service. Retrieval happens only
-- through owner's-rights procedures.
-- F7: that sentence is FALSE while secondary roles are active - a secondary
-- ACCOUNTADMIN satisfies the privilege check through the back door and the
-- GRANT audit still looks correct. Every app session runs
-- USE SECONDARY ROLES NONE, or authenticates as a dedicated service user.
EXECUTE IMMEDIATE FROM './governance/03_grants.sql';


-- ---------------------------------------------------------------------------
-- STEP 10 - Ontology and unit registry.  [2]
-- ---------------------------------------------------------------------------
-- Dynamic tables read these to normalise, and extract_assertions reads
-- is_safety_critical to decide which concepts get R7's second pass.
-- Must be populated before step 15.
EXECUTE IMMEDIATE FROM './data/ontology.sql';
EXECUTE IMMEDIATE FROM './data/unit_registry.sql';


-- ---------------------------------------------------------------------------
-- STEP 11 - Rules.  [2]
-- ---------------------------------------------------------------------------
-- 16 rules. Every one carries guideline_ref, provenance_note, version, severity
-- and specificity. provenance_note is mandatory and it is a scoring decision:
-- three thresholds are practice consensus, not guideline requirement, and must
-- say so wherever they surface.
EXECUTE IMMEDIATE FROM './data/rules.sql';


-- ---------------------------------------------------------------------------
-- STEP 12 - Load data.  [2]
-- ---------------------------------------------------------------------------
-- COPY INTO for CSV and FHIR bundles; PUT for PDFs. Normalisation needs the
-- ontology already loaded, which is why this follows step 10.
EXECUTE IMMEDIATE FROM './data/load_synthetic.sql';
EXECUTE IMMEDIATE FROM './data/load_structured_events.sql';
EXECUTE IMMEDIATE FROM './data/load_structured_events_copy.sql';
EXECUTE IMMEDIATE FROM './data/transform_structured_events.sql';
-- Idempotency note: load_structured_events_copy.sql now TRUNCATEs STG_SOURCE_EVENTS
-- before COPY INTO. transform_structured_events.sql MERGEs downstream. Safe on re-run.

-- Second synthetic patient, used only by Judge Console probe 2 - see that
-- file's header for why a single-patient system cannot demonstrate a
-- cross-patient leak.
EXECUTE IMMEDIATE FROM './data/load_judge_console_fixtures.sql';

-- Tomorrow's day-care list: 11 synthetic patients, each shaped around one real
-- blocker. Evidence only - every outcome comes from evaluate_gates (R1).
-- Dates are relative to CURRENT_DATE() and re-anchored on every deploy.
EXECUTE IMMEDIATE FROM './data/load_daycare_cohort.sql';


-- ---------------------------------------------------------------------------
-- STEP 13 - Streams.  [2]
-- ---------------------------------------------------------------------------
-- Directory table on PATIENT_DOCS, directory table on REFERENCE_DOCS, FHIR staging.
EXECUTE IMMEDIATE FROM './streams/01_streams.sql';


-- ---------------------------------------------------------------------------
-- STEP 14 - Procedures.  [1] and [2]
-- ---------------------------------------------------------------------------
-- 8 agent tools + 3 internal. All EXECUTE AS OWNER. No tool takes a patient
-- selector of any kind - not patient_id, not encounter_id. A1 is verified:
-- given a reachable parameter the agent fills it from the question text.
-- Every tool opens with the block in ./procedures/tools/_preamble.sql, and the
-- eight copies are diffed against it at the Day-5 gate.
EXECUTE IMMEDIATE FROM './procedures/bind_patient.sql';                      -- [2]
EXECUTE IMMEDIATE FROM './procedures/release_patient_binding.sql';          -- [2]
EXECUTE IMMEDIATE FROM './procedures/web_patient_context.sql';              -- [2]
EXECUTE IMMEDIATE FROM './procedures/web_review_tasks.sql';                 -- [2]
EXECUTE IMMEDIATE FROM './procedures/web_census.sql';                       -- [2]
EXECUTE IMMEDIATE FROM './procedures/evaluate_gates.sql';                    -- [2]
EXECUTE IMMEDIATE FROM './procedures/classify_question.sql';                 -- [1]
EXECUTE IMMEDIATE FROM './procedures/validate_answer.sql';                   -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/01_get_patient_facts.sql';        -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/02_get_readiness.sql';            -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/03_search_patient_documents.sql'; -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/04_search_reference_documents.sql'; -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/05_cohort_query.sql';             -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/06_get_timeline.sql';             -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/07_get_changes.sql';              -- [1]
EXECUTE IMMEDIATE FROM './procedures/tools/08_create_review_task.sql';       -- [1]


-- ---------------------------------------------------------------------------
-- STEP 15 - Dynamic tables.  [2]
-- ---------------------------------------------------------------------------
-- NO AI FUNCTIONS INSIDE A DYNAMIC TABLE - a DT requires deterministic refresh.
-- AI steps live in Tasks (step 16); deterministic steps live here.
-- DT_HARMONIZED_EVENTS is the load-bearing one: unit normalisation with
-- plausibility rejection, ANC from a differential, Cockcroft-Gault CrCl.
EXECUTE IMMEDIATE FROM './dynamic_tables/01_harmonized_events.sql';
<<<<<<< Updated upstream
EXECUTE IMMEDIATE FROM './procedures/chunk_documents.sql'; -- see procedures section - DOC_CHUNK is populated synchronously, not by a Dynamic Table (RAP-on-source made background refresh return zero rows, found live)
-- EXECUTE IMMEDIATE FROM './dynamic_tables/03_review_queue.sql';   -- [NOT BUILT]
-- EXECUTE IMMEDIATE FROM './dynamic_tables/04_scheme_eligibility.sql'; -- [NOT BUILT]
-- EXECUTE IMMEDIATE FROM './dynamic_tables/05_treatment_plan.sql'; -- [NOT BUILT]
=======
-- chunk_documents is a procedure not a DT (RAP-on-source made background refresh return zero rows, found live)
EXECUTE IMMEDIATE FROM './dynamic_tables/03_review_queue.sql';
EXECUTE IMMEDIATE FROM './dynamic_tables/04_scheme_eligibility.sql';
EXECUTE IMMEDIATE FROM './dynamic_tables/05_treatment_plan.sql';
>>>>>>> Stashed changes


-- ---------------------------------------------------------------------------
-- STEP 16 - Tasks.  [1] and [2]
-- ---------------------------------------------------------------------------
-- The only place AI functions may run.
<<<<<<< Updated upstream
EXECUTE IMMEDIATE FROM './tasks/parse_documents.sql';      -- [2]
-- EXECUTE IMMEDIATE FROM './tasks/flatten_fhir.sql';         -- [2]  [NOT BUILT]
EXECUTE IMMEDIATE FROM './tasks/extract_assertions.sql';   -- [1]  R7 two-pass
-- EXECUTE IMMEDIATE FROM './tasks/reconcile_evidence.sql';   -- [1]  [NOT BUILT]
EXECUTE IMMEDIATE FROM './tasks/refresh_readiness.sql';    -- [2]  populates READINESS_STATE for the day-care list
-- EXECUTE IMMEDIATE FROM './tasks/notify.sql';               -- [2]  [NOT BUILT]
=======
-- EXECUTE IMMEDIATE FROM './tasks/parse_documents.sql';      -- [2]
-- EXECUTE IMMEDIATE FROM './tasks/flatten_fhir.sql';         -- [2]
-- EXECUTE IMMEDIATE FROM './tasks/extract_assertions.sql';   -- [1]  R7 two-pass
-- EXECUTE IMMEDIATE FROM './tasks/reconcile_evidence.sql';   -- [1]
-- EXECUTE IMMEDIATE FROM './tasks/refresh_readiness.sql';    -- [2]
-- EXECUTE IMMEDIATE FROM './tasks/notify.sql';               -- [2]
EXECUTE IMMEDIATE FROM './tasks/flatten_fhir.sql';
EXECUTE IMMEDIATE FROM './tasks/reconcile_evidence.sql';
EXECUTE IMMEDIATE FROM './tasks/refresh_readiness.sql';
EXECUTE IMMEDIATE FROM './tasks/notify.sql';
EXECUTE IMMEDIATE FROM './tasks/orchestrator.sql';
>>>>>>> Stashed changes


-- ---------------------------------------------------------------------------
-- STEP 17 - Cortex Search services.  [2]
-- ---------------------------------------------------------------------------
-- TWO physically separate services, never one service with a filter. R6.
-- If patient text and guideline text share a ranked list, a guideline sentence
-- can be cited as evidence about a patient. Two of four surveyed competitors
-- mix them. TARGET_LAG = '1 minute' on the patient service so the mid-demo
-- addendum appears live.
EXECUTE IMMEDIATE FROM './search/01_patient_doc_search.sql';
EXECUTE IMMEDIATE FROM './search/02_reference_doc_search.sql';


-- ---------------------------------------------------------------------------
-- STEP 18 - Semantic view + 6 verified queries.  [2]
-- ---------------------------------------------------------------------------
EXECUTE IMMEDIATE FROM './semantic/01_semantic_view.sql';
-- EXECUTE IMMEDIATE FROM './semantic/02_verified_queries.sql'; -- [NOT BUILT]


-- ---------------------------------------------------------------------------
-- STEP 19 - Skills, then the agent.  [1]
-- ---------------------------------------------------------------------------
-- Skills upload via COPY INTO with TYPE=CSV, COMPRESSION=NONE,
-- RECORD_DELIMITER=NONE, FIELD_DELIMITER=NONE, SINGLE=TRUE - the documented way
-- to write markdown to a stage with no local PUT. Deployment stays reproducible
-- from SQL alone, which is the whole reason a judge can redeploy this.
-- The agent references the skill FOLDER, not the SKILL.md file.
-- EXECUTE IMMEDIATE FROM '../skills/upload_skills.sql'; -- [NOT BUILT]
EXECUTE IMMEDIATE FROM './agent/saarthi_agent.sql';
EXECUTE IMMEDIATE FROM './agent/ask_saarthi.sql'; -- entry point INTO the agent, not a Contract 2 tool
-- EXECUTE IMMEDIATE FROM './tasks/orchestrator.sql'; -- [NOT BUILT]
EXECUTE IMMEDIATE FROM './agent/saarthi_mcp.sql';


-- ---------------------------------------------------------------------------
-- STEP 19b - Judge Console: 8 security probes.  [2]
-- ---------------------------------------------------------------------------
-- SPEC.md §10. Depends on the agent tools (step 14), validate_answer (step 14),
-- and the second synthetic patient loaded in step 12 (probe 2 needs a real
-- second patient's chunk content to demonstrate a cross-patient leak).
EXECUTE IMMEDIATE FROM './procedures/judge/judge_probes.sql';


-- ---------------------------------------------------------------------------
-- STEP 20 - Streamlit.  [1]
-- ---------------------------------------------------------------------------
-- ROOT_LOCATION on the Git repository stage, not a fourth internal stage - the
-- object inventory says three stages and it must stay true.
-- Every session runs USE SECONDARY ROLES NONE.
-- EXECUTE IMMEDIATE FROM './integrations/02_streamlit.sql';


-- ---------------------------------------------------------------------------
-- STEP 21 - Notifications.  [2]
-- ---------------------------------------------------------------------------
-- Email + webhook for TASK_NOTIFY. Creatable any time after step 3.
-- EXECUTE IMMEDIATE FROM './integrations/01_notifications.sql';


-- =============================================================================
-- NOT PART OF THE DEPLOY
-- =============================================================================
-- backend/sql/stubs/ must NEVER be referenced from this file. It exists so Builder 1
-- never waits for Builder 2, and it is deleted at the Day-5 gate.
-- "Any answer is hard-coded" is a go/no-go failure; a surviving stub is how
-- that happens by accident. backend/scripts/check_gate.py --stubs enforces it.
-- =============================================================================
