-- =============================================================================
-- STEP 17b - REFERENCE_DOC_SEARCH
-- =============================================================================
-- SPEC.md §5. Physically separate from PATIENT_DOC_SEARCH - R6. Empty until
-- real regulatory PDFs (PM-JAY manual, NCCN, FDA labels) are downloaded into
-- data/reference/ and ingested with doc_scope='reference' - stated honestly,
-- not faked with synthetic regulatory text.
CREATE CORTEX SEARCH SERVICE IF NOT EXISTS SAARTHI.DOCUMENTS.REFERENCE_DOC_SEARCH
  ON text
  ATTRIBUTES doc_id, doc_type, page_index, jurisdiction, effective_date
  WAREHOUSE = SAARTHI_AI_WH
  TARGET_LAG = '1 hour'
  AS (SELECT chunk_id, text, doc_id, doc_type, page_index, jurisdiction, effective_date
      FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE doc_scope = 'reference');
