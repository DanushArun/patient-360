-- =============================================================================
-- STEP 16c - TASK saarthi_orchestrator (the "task on top")
-- =============================================================================
-- SPEC.md line 3 / hackathon "headline bonus": "one skill per process plus a
-- task on top which orchestrates between the three of them". This is that
-- task. It sequences the four operational steps that produce a fresh answer
-- state for every patient encounter:
--
--   parse_documents    -> extract text + pages from any new PDF (patient or
--                         reference corpus)
--   chunk_documents    -> split parsed pages into search chunks and populate
--                         DOC_CHUNK (synchronous, not a DT: RAP-on-source
--                         made background refresh return zero rows, found
--                         live and documented in evidence/coco/execution.yaml)
--   extract_assertions -> R7 two-pass typed extraction over new DOC_CHUNK rows
--   reconcile_evidence -> date documents, corroborate / conflict / promote
--                         verified values into CLINICAL_EVENT (the bridge from
--                         a document to a gate)
--   refresh_readiness  -> refresh DT_HARMONIZED_EVENTS synchronously, then
--                         re-evaluate every gate and replace READINESS_STATE
--   notify             -> REVIEW_TASK + NOTIFICATION for blockers within 3 days
--
-- Everything each step needs is already present as a procedure; the task
-- exists so a coordinator can hit "refresh" once and the whole chain runs
-- deterministically in order, not as four independent schedules whose
-- interleaving would be racy.
--
-- Scheduled 30 MINUTE by default. Downstream tasks (TASK_PARSE_DOCUMENTS,
-- TASK_EXTRACT_ASSERTIONS) already have their own stream-triggered schedules
-- for real-time ingestion; this orchestrator is the "on-demand full sweep"
-- path.

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.orchestrator_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Task on top - parse -> chunk -> extract -> reconcile -> DT refresh -> readiness -> notify, in order.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_parsed VARIANT;
    v_chunked VARIANT;
    v_extracted VARIANT;
    v_reconciled VARIANT;
    v_refreshed VARIANT;
    v_notified VARIANT;
    v_error VARCHAR;
BEGIN
    v_parsed := (CALL SAARTHI.OPERATIONAL.parse_documents_proc());
    v_chunked := (CALL SAARTHI.OPERATIONAL.chunk_documents_proc());
    v_extracted := (CALL SAARTHI.OPERATIONAL.extract_assertions_proc());
    v_reconciled := (CALL SAARTHI.OPERATIONAL.reconcile_evidence_proc());
    v_refreshed := (CALL SAARTHI.OPERATIONAL.refresh_readiness_proc());
    v_notified := (CALL SAARTHI.OPERATIONAL.notify_proc());

    RETURN OBJECT_CONSTRUCT(
        'orchestration_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS'),
        'parse', :v_parsed,
        'chunk', :v_chunked,
        'extract', :v_extracted,
        'reconcile', :v_reconciled,
        'readiness', :v_refreshed,
        'notify', :v_notified
    );
EXCEPTION
    WHEN OTHER THEN
        RETURN OBJECT_CONSTRUCT(
            'error', SQLERRM,
            'sqlcode', SQLCODE,
            'orchestration_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS')
        );
END;
$$;

CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_SAARTHI_ORCHESTRATOR
  WAREHOUSE = SAARTHI_AI_WH
  SCHEDULE = 'USING CRON 30 5 * * * Asia/Kolkata'
  -- Left SUSPENDED by tasks/99_resume_tasks.sql: the document chain and the
  -- 06:00 readiness run cover the schedule. This is the on-demand full sweep:
  --   EXECUTE TASK SAARTHI.OPERATIONAL.TASK_SAARTHI_ORCHESTRATOR;
AS
  CALL SAARTHI.OPERATIONAL.orchestrator_proc();
