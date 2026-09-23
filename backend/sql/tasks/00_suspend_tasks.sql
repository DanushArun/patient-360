-- =============================================================================
-- STEP 16 (first) - Suspend running task roots before replacing any task
-- =============================================================================
-- CREATE OR REPLACE TASK on a child fails while its root is running, so a
-- redeploy onto an account where tasks/99_resume_tasks.sql already ran must
-- suspend the roots first. IF EXISTS keeps a clean-account deploy working.
ALTER TASK IF EXISTS SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS SUSPEND;
ALTER TASK IF EXISTS SAARTHI.OPERATIONAL.TASK_REFRESH_READINESS SUSPEND;
ALTER TASK IF EXISTS SAARTHI.OPERATIONAL.TASK_FLATTEN_FHIR SUSPEND;
ALTER TASK IF EXISTS SAARTHI.OPERATIONAL.TASK_SAARTHI_ORCHESTRATOR SUSPEND;
