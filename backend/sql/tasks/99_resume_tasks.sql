-- =============================================================================
-- STEP 22 - Resume the schedules
-- =============================================================================
-- Runs last, after every object and grant exists. What runs, and what it costs:
--
--   TASK_PARSE_DOCUMENTS -> CHUNK -> EXTRACT -> RECONCILE -> DOCUMENT_READINESS
--       every 5 minutes WHEN a file has landed on @PATIENT_DOCS. The WHEN
--       check needs no warehouse, so an idle account spends nothing.
--   TASK_REFRESH_READINESS -> TASK_NOTIFY
--       daily 06:00 India time: the day-before check (~2 minutes).
--   TASK_FLATTEN_FHIR
--       daily 05:45 India time; a no-op until FHIR bundles land.
--   TASK_SAARTHI_ORCHESTRATOR
--       not resumed - on demand: EXECUTE TASK SAARTHI.OPERATIONAL.TASK_SAARTHI_ORCHESTRATOR;
--
-- Stop everything: backend/sql/tasks/00_suspend_tasks.sql.
SELECT SYSTEM$TASK_DEPENDENTS_ENABLE('SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS');
SELECT SYSTEM$TASK_DEPENDENTS_ENABLE('SAARTHI.OPERATIONAL.TASK_REFRESH_READINESS');
ALTER TASK SAARTHI.OPERATIONAL.TASK_FLATTEN_FHIR RESUME;
