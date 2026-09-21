-- =============================================================================
-- STEP 17a - PATIENT_DOC_SEARCH
-- =============================================================================
-- SPEC.md §5. R6: two physically separate services, never one with a filter.
-- Sourced from DOC_CHUNK (no RAP - F4). Content is re-fetched from
-- RAP-protected DOC_PAGE by the calling procedure (Layer 3 of R5) -
-- this service returns IDs and text for ranking only.
CREATE CORTEX SEARCH SERVICE IF NOT EXISTS SAARTHI.DOCUMENTS.PATIENT_DOC_SEARCH
  ON text
  ATTRIBUTES patient_id, doc_id, doc_type, page_index, doc_version
  WAREHOUSE = SAARTHI_AI_WH
  TARGET_LAG = '1 minute'
  AS (SELECT chunk_id, text, patient_id, doc_id, doc_type, page_index, doc_version
      FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE doc_scope = 'patient');
