-- =============================================================================
-- STEP 14 - Tool 4: search_reference_documents
-- =============================================================================
-- Contract 2. R6: physically separate corpus, NO patient data anywhere in
-- this tool - it does not resolve or require a patient binding at all,
-- unlike every other tool. Still requires an authenticated practitioner
-- (not an anonymous caller), just not a bound patient.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.search_reference_documents(
    QUERY VARCHAR, JURISDICTION VARCHAR DEFAULT NULL, EFFECTIVE_DATE VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 4. Reference corpus only. No patient data, no patient binding required.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_practitioner VARCHAR;
    v_payload      VARCHAR;
    v_search_json  VARCHAR;
    v_hits         VARIANT;
    v_out          ARRAY DEFAULT ARRAY_CONSTRUCT();
    v_n            INTEGER;
    v_i            INTEGER DEFAULT 0;
BEGIN
    v_practitioner := (SELECT practitioner_id FROM SAARTHI.GOVERNANCE.PRACTITIONER
                        WHERE snowflake_user = CURRENT_USER() AND active = TRUE);
    IF (v_practitioner IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;

    LET v_filter_obj VARIANT := OBJECT_CONSTRUCT();
    IF (:JURISDICTION IS NOT NULL) THEN
        v_filter_obj := OBJECT_CONSTRUCT('@eq', OBJECT_CONSTRUCT('jurisdiction', :JURISDICTION));
    END IF;

    v_payload := (SELECT TO_JSON(OBJECT_CONSTRUCT(
            'query', :QUERY,
            'columns', ARRAY_CONSTRUCT('chunk_id', 'doc_id', 'page_index', 'jurisdiction', 'effective_date'),
            'limit', 5
        )));
    v_search_json := (SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'SAARTHI.DOCUMENTS.REFERENCE_DOC_SEARCH', :v_payload));
    v_hits := GET_PATH(PARSE_JSON(:v_search_json), 'results');
    v_n := ARRAY_SIZE(:v_hits);

    WHILE (v_i < v_n) DO
        LET v_hit VARIANT := GET(:v_hits, :v_i);
        LET v_doc_id VARCHAR := GET_PATH(:v_hit, 'doc_id')::VARCHAR;
        LET v_page_index INTEGER := GET_PATH(:v_hit, 'page_index')::INTEGER;

        -- Reference corpus carries no RAP (no patient scope to enforce), so
        -- the chunk text itself is authoritative here - unlike the patient
        -- path, there is no governed table to re-fetch through.
        LET v_text VARCHAR := NULL;
        SELECT text INTO :v_text FROM SAARTHI.DOCUMENTS.DOC_CHUNK
         WHERE doc_id = :v_doc_id AND page_index = :v_page_index AND doc_scope = 'reference';

        v_out := ARRAY_APPEND(v_out, OBJECT_CONSTRUCT(
            'kind', 'reference_clause', 'doc_id', v_doc_id, 'page_index', v_page_index,
            'jurisdiction', GET_PATH(:v_hit, 'jurisdiction'), 'effective_date', GET_PATH(:v_hit, 'effective_date'),
            'text', v_text));
        v_i := v_i + 1;
    END WHILE;

    RETURN OBJECT_CONSTRUCT('results', v_out);
END;
$$;
