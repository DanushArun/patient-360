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
--   reconcile_evidence -> conflicts, cross-specimen links, assertion->event 'supports' links
--   refresh_readiness  -> re-evaluate all 16 gates and MERGE into READINESS_STATE
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
  COMMENT = 'Task on top - orchestrates parse -> chunk -> extract -> refresh in order.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_parsed VARIANT;
    v_chunked VARIANT;
    v_extracted VARIANT;
    v_reconciled VARIANT;
    v_refreshed VARIANT;
    v_error VARCHAR;
BEGIN
    v_parsed := (CALL SAARTHI.OPERATIONAL.parse_documents_proc());
    v_chunked := (CALL SAARTHI.OPERATIONAL.chunk_documents_proc());
    v_extracted := (CALL SAARTHI.OPERATIONAL.extract_assertions_proc());
    -- reconcile_evidence writes the EVIDENCE_LINK rows (assertion -> event 'supports') that let a
    -- gate cite the verified document span behind its number. It was only reachable as a child of
    -- TASK_EXTRACT_ASSERTIONS, so an on-demand sweep left every gate without document provenance.
    v_reconciled := (CALL SAARTHI.OPERATIONAL.reconcile_evidence_proc());
    v_refreshed := (CALL SAARTHI.OPERATIONAL.refresh_readiness_proc());

    RETURN OBJECT_CONSTRUCT(
        'orchestration_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS'),
        'parse', :v_parsed,
        'chunk', :v_chunked,
        'extract', :v_extracted,
        'reconcile', :v_reconciled,
        'readiness', :v_refreshed
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
  SCHEDULE = '30 MINUTE'
AS
  CALL SAARTHI.OPERATIONAL.orchestrator_proc();
