-- =============================================================================
-- STEP 13 - Streams
-- =============================================================================
-- Directory table stream on PATIENT_DOCS. Fires parse_documents whenever a
-- new file lands (or an existing one is re-registered by ALTER STAGE REFRESH).
CREATE STREAM IF NOT EXISTS SAARTHI.DOCUMENTS.DOC_STREAM ON STAGE SAARTHI.STAGES.PATIENT_DOCS;
