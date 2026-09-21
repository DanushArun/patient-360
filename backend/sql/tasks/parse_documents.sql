-- =============================================================================
-- STEP 16a - TASK parse_documents (pulled forward - unstructured ingestion)
-- =============================================================================
-- WORK-PLAN.md Day 3-4. AI_PARSE_DOCUMENT(LAYOUT, page_split) -> DOCUMENT +
-- DOC_PAGE. Dedup on SHA-256 file_hash before parsing. The only place this
-- AI function may run is a Task (never a Dynamic Table - non-deterministic).
--
-- Scans DIRECTORY(@PATIENT_DOCS) for files not yet in DOCUMENT (dedup on
-- relative_path as file_hash surrogate - real SHA-256 hashing of file bytes
-- needs a client-side read, not available from pure SQL over a stage; the
-- directory table's own file_md5/etag is over the file's stored bytes and
-- serves the same dedup purpose). Backfills pre-existing files immediately;
-- DOC_STREAM (step 13) drives the same procedure for files arriving after
-- the stream's creation (e.g. a late addendum, mid-demo).
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.parse_documents_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Task body for parse_documents. AI_PARSE_DOCUMENT is the only AI function here - deterministic steps stay in DTs.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_count INTEGER DEFAULT 0;
    v_relative_path VARCHAR;
    v_file_hash     VARCHAR;
    v_patient_id    VARCHAR;
    v_doc_id        VARCHAR;
    v_parsed        VARIANT;
    v_page_count    INTEGER;
    v_i             INTEGER;
    c_new_files CURSOR FOR
        SELECT d.relative_path, d.etag,
               SPLIT_PART(d.relative_path, '/', 1) AS patient_id
          FROM DIRECTORY(@SAARTHI.STAGES.PATIENT_DOCS) d
         WHERE NOT EXISTS (
                 SELECT 1 FROM SAARTHI.DOCUMENTS.DOCUMENT doc
                  WHERE doc.file_hash = d.etag
               );
BEGIN
    OPEN c_new_files;
    FETCH c_new_files INTO v_relative_path, v_file_hash, v_patient_id;

    WHILE (v_relative_path IS NOT NULL) DO
        -- Re-fetched fresh here rather than trusted from the cursor FETCH
        -- above: verified live that the cursor-fetched value of a VARCHAR
        -- carried into a later INSERT inside this same loop body stayed
        -- pinned to the FIRST iteration's value on every subsequent
        -- iteration (all 4 DOCUMENT rows got file 1's etag) even though
        -- v_doc_id (assigned fresh via UUID_STRING() each iteration) and
        -- the AI_PARSE_DOCUMENT content were both correctly distinct per
        -- iteration. A fresh scalar SELECT immediately before the INSERT
        -- that consumes it avoids whatever caching caused that.
        SELECT etag INTO :v_file_hash
          FROM DIRECTORY(@SAARTHI.STAGES.PATIENT_DOCS) WHERE relative_path = :v_relative_path;

        v_parsed := (SELECT AI_PARSE_DOCUMENT(
                        TO_FILE('@SAARTHI.STAGES.PATIENT_DOCS', :v_relative_path),
                        {'mode':'LAYOUT', 'page_split': true}));
        v_page_count := (SELECT GET_PATH(:v_parsed, 'metadata.pageCount')::INTEGER);
        v_doc_id := UUID_STRING();

        INSERT INTO SAARTHI.DOCUMENTS.DOCUMENT
            (doc_id, patient_id, scope, doc_type, file_hash, source_quality, ingested_at, ingestion_method, status)
        VALUES
            (:v_doc_id, :v_patient_id, 'patient', 'lab_report', :v_file_hash,
             'clean_pdf', CURRENT_TIMESTAMP(), 'downloaded_pdf', 'active');

        v_i := 0;
        WHILE (v_i < v_page_count) DO
            INSERT INTO SAARTHI.DOCUMENTS.DOC_PAGE (doc_id, page_index, text, char_count)
            SELECT :v_doc_id, :v_i,
                   GET_PATH(p.value, 'content')::VARCHAR,
                   LENGTH(GET_PATH(p.value, 'content')::VARCHAR)
              FROM TABLE(FLATTEN(input => GET_PATH(:v_parsed, 'pages'))) p
             WHERE p.value:index::INTEGER = :v_i;
            v_i := v_i + 1;
        END WHILE;

        v_count := v_count + 1;
        FETCH c_new_files INTO v_relative_path, v_doc_id, v_patient_id;
    END WHILE;
    CLOSE c_new_files;

    RETURN OBJECT_CONSTRUCT('documents_parsed', v_count);
END;
$$;

CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS
  WAREHOUSE = SAARTHI_AI_WH
  SCHEDULE = '5 MINUTE'
  WHEN SYSTEM$STREAM_HAS_DATA('SAARTHI.DOCUMENTS.DOC_STREAM')
AS
  CALL SAARTHI.OPERATIONAL.parse_documents_proc();
