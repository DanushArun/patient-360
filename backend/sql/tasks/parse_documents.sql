-- =============================================================================
-- STEP 16a - TASK parse_documents (pulled forward - unstructured ingestion)
-- =============================================================================
-- WORK-PLAN.md Day 3-4. AI_PARSE_DOCUMENT(LAYOUT, page_split) -> DOCUMENT +
-- DOC_PAGE. Dedup on stage source_path (legacy fallback: etag) before parsing. The only place this
-- AI function may run is a Task (never a Dynamic Table - non-deterministic).
--
-- Scans DIRECTORY(@PATIENT_DOCS) for files not yet in DOCUMENT. Dedup key (Round 6, unverified-needs-deploy):
-- DOCUMENT.source_path = the stage relative_path, which is stable across runs. Rows loaded before source_path
-- existed are matched on file_hash = etag as a legacy fallback only. Never etag alone: bounded loaders store a
-- SHA-256 in file_hash, which can never equal a stage etag, so an etag-only key re-parses (paid) every staged
-- file. Rows this task inserts still store the stage etag in file_hash (a real SHA-256 needs a client-side read);
-- the dedupe does not depend on it. Backfills pre-existing files immediately;
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
    v_first_text    VARCHAR;
    v_doc_type      VARCHAR;
    v_type_count    INTEGER;
    v_reference_count INTEGER DEFAULT 0;
    v_run_id        VARCHAR DEFAULT UUID_STRING();
    -- A file is already ingested if a DOCUMENT row records its stage path (source_path)
    -- or, for rows from before that column, its etag. file_hash alone never matched:
    -- rows loaded by the bounded scripts hold a SHA-256, never an etag.
    c_new_files CURSOR FOR
        SELECT d.relative_path, d.etag,
               SPLIT_PART(d.relative_path, '/', 1) AS patient_id
          FROM DIRECTORY(@SAARTHI.STAGES.PATIENT_DOCS) d
         WHERE NOT EXISTS (
                 SELECT 1 FROM SAARTHI.DOCUMENTS.DOCUMENT doc
                  WHERE doc.scope = 'patient'
                    AND (doc.source_path = d.relative_path OR doc.file_hash = d.etag)
               );
    c_new_reference CURSOR FOR
        SELECT d.relative_path, d.etag
          FROM DIRECTORY(@SAARTHI.STAGES.REFERENCE_DOCS) d
         WHERE NOT EXISTS (
                 SELECT 1 FROM SAARTHI.DOCUMENTS.DOCUMENT doc
                  WHERE doc.scope = 'reference'
                    AND (doc.source_path = d.relative_path OR doc.file_hash = d.etag)
               );
BEGIN
    -- Internal-stage directory tables refresh only on demand, so an upload is invisible
    -- to DIRECTORY() and DOC_STREAM until refreshed. Uploaders refresh PATIENT_DOCS so
    -- the stream fires this task; refreshing here as well covers REFERENCE_DOCS, which
    -- has no stream.
    ALTER STAGE SAARTHI.STAGES.PATIENT_DOCS REFRESH;
    ALTER STAGE SAARTHI.STAGES.REFERENCE_DOCS REFRESH;
    -- Consume DOC_STREAM. The work list is DIRECTORY(), not the stream, but an unconsumed
    -- stream keeps SYSTEM$STREAM_HAS_DATA true and wakes this task every 5 minutes
    -- forever. The DML that consumes it doubles as the run's audit row.
    INSERT INTO SAARTHI.OPERATIONAL.INGESTION_RUN (run_id, source_id, records_received, file_hashes)
    SELECT :v_run_id, 'PATIENT_DOCS', COUNT(*), ARRAY_AGG(etag)
      FROM SAARTHI.DOCUMENTS.DOC_STREAM WHERE METADATA$ACTION = 'INSERT';
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
        -- Record unusable parses once as unreadable; retain exact page validation.
        IF (v_page_count IS NULL OR v_page_count<1 OR NOT COALESCE(IS_ARRAY(v_parsed:pages),FALSE)
            OR ARRAY_SIZE(v_parsed:pages)!=v_page_count) THEN
            INSERT INTO SAARTHI.DOCUMENTS.DOCUMENT
                (doc_id, patient_id, scope, doc_type, file_hash, source_path, ingested_at, ingestion_method, status)
            VALUES (:v_doc_id, :v_patient_id, 'patient', 'unknown', :v_file_hash, :v_relative_path,
                    CURRENT_TIMESTAMP(), 'downloaded_pdf', 'unreadable');
            v_count := v_count + 1;
            FETCH c_new_files INTO v_relative_path, v_file_hash, v_patient_id;
            CONTINUE;
        END IF;
        SELECT COUNT(DISTINCT value:index::INTEGER) INTO :v_type_count
          FROM TABLE(FLATTEN(input=>:v_parsed:pages))
         WHERE IS_INTEGER(value:index) AND value:index::INTEGER>=0
           AND value:index::INTEGER<:v_page_count AND IS_VARCHAR(value:content);
        IF (v_type_count!=v_page_count) THEN
            INSERT INTO SAARTHI.DOCUMENTS.DOCUMENT
                (doc_id, patient_id, scope, doc_type, file_hash, source_path, ingested_at, ingestion_method, status)
            VALUES (:v_doc_id, :v_patient_id, 'patient', 'unknown', :v_file_hash, :v_relative_path,
                    CURRENT_TIMESTAMP(), 'downloaded_pdf', 'unreadable');
            v_count := v_count + 1;
            FETCH c_new_files INTO v_relative_path, v_file_hash, v_patient_id;
            CONTINUE;
        END IF;
        v_first_text := NULL;
        SELECT value:content::VARCHAR INTO :v_first_text
          FROM TABLE(FLATTEN(input=>:v_parsed:pages)) WHERE value:index::INTEGER=0;
        -- Conservative explicit-heading routing, not a clinical classifier.
        -- Unknown/ambiguous headers stay unknown. No model call or filename guess.
        SELECT COUNT(DISTINCT h.doc_type),MIN(h.doc_type) INTO :v_type_count,:v_doc_type
          FROM TABLE(SPLIT_TO_TABLE(REPLACE(UPPER(:v_first_text),CHR(13),''),CHR(10))) line
          JOIN (SELECT column1 AS title,column2 AS doc_type FROM VALUES
            ('COMPLETE BLOOD COUNT','lab_report'),('LABORATORY REPORT','lab_report'),
            ('HISTOPATHOLOGY / HER2 REPORT','pathology_report'),('HISTOPATHOLOGY REPORT','pathology_report'),
            ('RADIOLOGY REPORT','imaging_report'),('DISCHARGE SUMMARY','discharge_summary'),
            ('AUTHORIZATION LETTER','authorization_letter'),('AUTHORISATION LETTER','authorization_letter'),
            ('PRESCRIPTION','prescription'),('CONSENT FORM','consent_form'),('REFERRAL LETTER','referral_letter')) h
            ON TRIM(line.value)=h.title WHERE line.index<=8;
        IF (v_type_count!=1) THEN v_doc_type:='unknown'; END IF;
        -- NULL means capture quality is unassessed (metadata, not clinical missingness).
        -- Clean extracted text cannot prove a clean image. Do not change the enum.
        INSERT INTO SAARTHI.DOCUMENTS.DOCUMENT
            (doc_id, patient_id, scope, doc_type, file_hash, source_path, source_quality, ingested_at, ingestion_method, status)
        VALUES
            (:v_doc_id, :v_patient_id, 'patient', :v_doc_type, :v_file_hash, :v_relative_path,
             NULL, CURRENT_TIMESTAMP(), 'downloaded_pdf', 'active');

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
        -- Was INTO ..., v_doc_id, ...: the etag landed in v_doc_id and v_file_hash kept
        -- the previous file's value, so dedupe could not hold across iterations.
        FETCH c_new_files INTO v_relative_path, v_file_hash, v_patient_id;
    END WHILE;
    CLOSE c_new_files;

    -- Reference corpus (R6): same shape as the patient loop but scope='reference',
    -- patient_id NULL, and stage is REFERENCE_DOCS. R6 keeps the two corpora in
    -- physically separate SEARCH SERVICES; a single parse task can populate both
    -- because scope on the DOCUMENT row is what routes each chunk to the right
    -- index (chunk_documents_proc copies d.scope into DOC_CHUNK.doc_scope).
    OPEN c_new_reference;
    FETCH c_new_reference INTO v_relative_path, v_file_hash;
    WHILE (v_relative_path IS NOT NULL) DO
        -- Same fresh SELECT etag pattern as the patient loop above,
        -- preserving the workaround for the cursor-value-pinning bug found live.
        SELECT etag INTO :v_file_hash
          FROM DIRECTORY(@SAARTHI.STAGES.REFERENCE_DOCS) WHERE relative_path = :v_relative_path;

        v_parsed := (SELECT AI_PARSE_DOCUMENT(
                        TO_FILE('@SAARTHI.STAGES.REFERENCE_DOCS', :v_relative_path),
                        {'mode':'LAYOUT', 'page_split': true}));
        v_page_count := (SELECT GET_PATH(:v_parsed, 'metadata.pageCount')::INTEGER);
        v_doc_id := UUID_STRING();

        INSERT INTO SAARTHI.DOCUMENTS.DOCUMENT
            (doc_id, patient_id, scope, doc_type, file_hash, source_path, source_quality, ingested_at, ingestion_method, status)
        VALUES
            (:v_doc_id, NULL, 'reference', 'clinical_guideline', :v_file_hash, :v_relative_path,
             NULL, CURRENT_TIMESTAMP(), 'downloaded_pdf', 'active');

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

        v_reference_count := v_reference_count + 1;
        FETCH c_new_reference INTO v_relative_path, v_file_hash;
    END WHILE;
    CLOSE c_new_reference;

    -- Chunk in the same run so new pages reach Cortex Search; the stream-triggered chain
    -- otherwise never chunks (only the orchestrator did).
    CALL SAARTHI.OPERATIONAL.chunk_documents_proc();
    UPDATE SAARTHI.OPERATIONAL.INGESTION_RUN
       SET completed_at = CURRENT_TIMESTAMP(), records_loaded = :v_count + :v_reference_count
     WHERE run_id = :v_run_id;
    RETURN OBJECT_CONSTRUCT(
        'run_id', v_run_id,
        'documents_parsed', v_count,
        'reference_documents_parsed', v_reference_count
    );
END;
$$;

-- EXECUTE AS USER: chunk_documents_proc reads DOC_PAGE, whose row access policy keys on
-- CURRENT_USER() (F3); a task with no user sees no patient pages. The named user must be an
-- active practitioner on the relevant care teams, and the owner needs IMPERSONATE on it.
CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS
  WAREHOUSE = SAARTHI_AI_WH
  SCHEDULE = '5 MINUTE'
  EXECUTE AS USER SITAR
  WHEN SYSTEM$STREAM_HAS_DATA('SAARTHI.DOCUMENTS.DOC_STREAM')
AS
  CALL SAARTHI.OPERATIONAL.parse_documents_proc();
