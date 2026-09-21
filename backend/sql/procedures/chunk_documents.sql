-- =============================================================================
-- STEP 15b - chunk_documents (populates the real DOC_CHUNK table)
-- =============================================================================
-- Corrects a real mistake found live: DT_DOC_CHUNK was created as a SEPARATE
-- Dynamic Table, duplicating DOC_CHUNK, which Contract 1 already defines as
-- a plain table (backend/sql/tables/30_documents.sql). Worse, the Dynamic
-- Table came back permanently empty: its background refresh has no real
-- CURRENT_USER() matching any PRACTITIONER, so DOC_PAGE's row access policy
-- silently filtered out every row - identical query, zero rows, because a
-- scheduled DT refresh is not a human session. Fixed by populating the
-- correct DOC_CHUNK table via a synchronous EXECUTE AS OWNER procedure call
-- instead: F3 (CURRENT_USER() survives owner's-rights elevation) makes this
-- work, because a synchronous CALL has a real caller. Called by
-- parse_documents_proc going forward, or run manually to backfill.
-- NO RAP on DOC_CHUNK - F4 forces this; content stays behind DOC_PAGE's policy.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.chunk_documents_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Populates DOC_CHUNK from DOC_PAGE. Page-level chunking. EXECUTE AS OWNER so DOC_PAGE RAP resolves against the real caller (F3).'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_count INTEGER DEFAULT 0;
BEGIN
    INSERT INTO SAARTHI.DOCUMENTS.DOC_CHUNK
        (chunk_id, doc_id, page_index, chunk_index, text, doc_scope, patient_id, doc_type, doc_version, jurisdiction, effective_date)
    SELECT
        dp.doc_id || '-' || dp.page_index, dp.doc_id, dp.page_index, 0, dp.text,
        d.scope, d.patient_id, d.doc_type, d.version, d.jurisdiction, d.effective_date
    FROM SAARTHI.DOCUMENTS.DOC_PAGE dp
    JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id = dp.doc_id
    WHERE d.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM SAARTHI.DOCUMENTS.DOC_CHUNK c
                        WHERE c.doc_id = dp.doc_id AND c.page_index = dp.page_index);
    v_count := SQLROWCOUNT;
    RETURN OBJECT_CONSTRUCT('chunks_created', v_count);
END;
$$;
