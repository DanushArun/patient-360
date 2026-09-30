-- =============================================================================
-- STEP 14 - Tool 3: search_patient_documents
-- =============================================================================
-- Contract 2. R5 Layers 2+3, both enforced here, not just designed:
-- Layer 2 - the @eq patient_id filter is injected server-side from the
--   BINDING, never from the question or an agent-supplied parameter.
-- Layer 3 - the search service returns chunk_id only; text is re-fetched
--   from RAP-protected DOC_PAGE, keyed on the real caller (F3). Even a
--   leaked chunk_id yields nothing without a genuine CARE_TEAM relationship.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.search_patient_documents(
    QUERY VARCHAR, KNOWN_AS_OF VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 3. Patient corpus, server-injected filter, content re-fetched through the RAP. Takes no patient selector.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_known_as_of    TIMESTAMP_NTZ;
    v_known_as_of_s  VARCHAR;
    v_binding_id     VARCHAR;
    v_patient_id     VARCHAR;
    v_practitioner   VARCHAR;
    v_care_team_id   VARCHAR;
    v_consent_id     VARCHAR;
    v_search_json    VARCHAR;
    v_hits           VARIANT;
    v_out            ARRAY DEFAULT ARRAY_CONSTRUCT();
    v_n              INTEGER;
    v_i              INTEGER DEFAULT 0;
BEGIN
-- >>> SAARTHI PREAMBLE v1 BEGIN
    -- 0 -- KNOWN_AS_OF. Resolved before anything can fail, so every error carries it.
    v_known_as_of := COALESCE(TRY_TO_TIMESTAMP_NTZ(:KNOWN_AS_OF), CURRENT_TIMESTAMP());
    v_known_as_of_s := TO_VARCHAR(:v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS');

    -- 1 -- SELECTION. The subject comes from a human click, never from question text.
    v_binding_id := (SELECT binding_id
                       FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                      WHERE session_id = CURRENT_SESSION()
                        AND released_at IS NULL
                      ORDER BY bound_at DESC
                      LIMIT 1);
    IF (v_binding_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_bound',
                                'known_as_of', :v_known_as_of_s);
    END IF;

    v_patient_id := (SELECT patient_id
                       FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                      WHERE binding_id = :v_binding_id);

    -- 2 -- AUTHORISATION. CURRENT_USER() survives owner's-rights elevation; CURRENT_ROLE() does not (F3).
    v_practitioner := (SELECT practitioner_id
                         FROM SAARTHI.GOVERNANCE.PRACTITIONER
                        WHERE snowflake_user = CURRENT_USER()
                          AND active = TRUE);
    IF (v_practitioner IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access',
                                'known_as_of', :v_known_as_of_s);
    END IF;

    v_care_team_id := (SELECT care_team_id
                         FROM SAARTHI.GOVERNANCE.CARE_TEAM
                        WHERE practitioner_id = :v_practitioner
                          AND patient_id     = :v_patient_id
                          AND active_from   <= CURRENT_DATE()
                          AND (active_to IS NULL OR active_to >= CURRENT_DATE())
                        ORDER BY active_from DESC
                        LIMIT 1);
    IF (v_care_team_id IS NULL) THEN
        -- Reveals nothing about whether the patient exists. Do not add a reason.
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access',
                                'known_as_of', :v_known_as_of_s);
    END IF;

    -- 3 -- CONSENT, at query time. Never at ingest, never cached in the binding.
    v_consent_id := (SELECT c.consent_id
                       FROM SAARTHI.GOVERNANCE.CONSENT c
                       JOIN SAARTHI.GOVERNANCE.PRACTITIONER p
                         ON p.practitioner_id = :v_practitioner
                       LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f
                         ON f.facility_id = p.facility_id
                      WHERE c.patient_id = :v_patient_id
                        AND c.status     = 'active'
                        AND c.valid_from <= CURRENT_TIMESTAMP()
                        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                        AND c.purpose_code IN ('treatment', 'coordination')
                        AND (c.granted_to_facility_id = p.facility_id
                          OR c.granted_to_org_id      = f.org_id)
                      ORDER BY c.valid_from DESC
                      LIMIT 1);
    IF (v_consent_id IS NULL) THEN
        -- Release the binding: the context is cleared, not merely hidden.
        UPDATE SAARTHI.GOVERNANCE.PATIENT_BINDING
           SET released_at = CURRENT_TIMESTAMP()
         WHERE binding_id = :v_binding_id
           AND released_at IS NULL;
        -- This code DOES reveal that a record exists. That is deliberate: it only
        -- reaches a user who previously had legitimate access to it.
        RETURN OBJECT_CONSTRUCT('error', 'access_withdrawn',
                                'known_as_of', :v_known_as_of_s);
    END IF;
-- <<< SAARTHI PREAMBLE v1 END

    -- Layer 2: @eq filter injected server-side from v_patient_id (the
    -- binding), never from QUERY or any agent-supplied parameter.
    -- SEARCH_PREVIEW rejects an inline expression as its 2nd argument -
    -- verified live - so the JSON payload is materialised into a plain
    -- string variable first, then passed by reference.
    LET v_payload VARCHAR := (SELECT TO_JSON(OBJECT_CONSTRUCT(
            'query', :QUERY,
            'columns', ARRAY_CONSTRUCT('chunk_id', 'doc_id', 'page_index'),
            'filter', OBJECT_CONSTRUCT('@eq', OBJECT_CONSTRUCT('patient_id', :v_patient_id)),
            'limit', 5
        )));
    v_search_json := (SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'SAARTHI.DOCUMENTS.PATIENT_DOC_SEARCH', :v_payload));
    v_hits := GET_PATH(PARSE_JSON(:v_search_json), 'results');
    v_n := ARRAY_SIZE(:v_hits);

    WHILE (v_i < v_n) DO
        LET v_hit VARIANT := GET(:v_hits, :v_i);
        LET v_doc_id VARCHAR := GET_PATH(:v_hit, 'doc_id')::VARCHAR;
        LET v_page_index INTEGER := GET_PATH(:v_hit, 'page_index')::INTEGER;
        LET v_chunk_id VARCHAR := GET_PATH(:v_hit, 'chunk_id')::VARCHAR;

        -- Layer 3: re-fetch the actual text from RAP-protected DOC_PAGE.
        -- Even if v_hit's doc_id were somehow for another patient, this
        -- SELECT resolves nothing - CURRENT_USER() survives owner's-rights
        -- elevation (F3), so the RAP still filters by the real caller.
        LET v_text VARCHAR := NULL;
        SELECT dp.text INTO :v_text
          FROM SAARTHI.DOCUMENTS.DOC_PAGE dp WHERE dp.doc_id = :v_doc_id AND dp.page_index = :v_page_index;

        IF (v_text IS NOT NULL) THEN
            v_out := ARRAY_APPEND(v_out, OBJECT_CONSTRUCT(
                'kind', 'document_span', 'chunk_id', v_chunk_id, 'doc_id', v_doc_id,
                'page_index', v_page_index, 'text', v_text));
        END IF;
        v_i := v_i + 1;
    END WHILE;

    RETURN OBJECT_CONSTRUCT('results', v_out, 'binding_id', v_binding_id, 'known_as_of', v_known_as_of_s);
END;
$$;
