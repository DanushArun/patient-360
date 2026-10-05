-- Legacy compatibility uses literal identifiers only; no prose is parsed as a medical fact.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RESOLVE_IDS(
    IDS ARRAY, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_access VARIANT;
    v_patient VARCHAR;
    v_claims ARRAY;
BEGIN
    v_access := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),:KNOWN_AS_OF));
    IF (v_access:error IS NOT NULL) THEN RETURN v_access; END IF;
    SELECT patient_id INTO :v_patient FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
     WHERE session_id=CURRENT_SESSION() AND released_at IS NULL ORDER BY bound_at DESC LIMIT 1;
    IF (IDS IS NULL OR ARRAY_SIZE(IDS)>128) THEN
        RETURN OBJECT_CONSTRUCT('error','invalid_candidate','known_as_of',KNOWN_AS_OF);
    END IF;
    SELECT COALESCE(ARRAY_AGG(claim) WITHIN GROUP (ORDER BY id),ARRAY_CONSTRUCT()) INTO :v_claims
    FROM (SELECT DISTINCT h.event_id AS id,OBJECT_CONSTRUCT('text','Recorded source',
        'claim_type','textual','evidence',ARRAY_CONSTRUCT(
            OBJECT_CONSTRUCT('kind','structured','id',h.event_id))) AS claim
      FROM TABLE(FLATTEN(input=>:IDS)) i JOIN SAARTHI.CORE.DT_HARMONIZED_EVENTS h
        ON h.event_id=i.value::VARCHAR
     WHERE h.patient_id=:v_patient AND h.ingested_at<=TRY_TO_TIMESTAMP_NTZ(:KNOWN_AS_OF)
    UNION ALL
    SELECT DISTINCT a.assertion_id AS id,OBJECT_CONSTRUCT('text','Source passage: "'
        || SUBSTR(dp.text,a.char_start+1,a.char_end-a.char_start) || '"',
        'claim_type','textual','evidence',ARRAY_CONSTRUCT(
            OBJECT_CONSTRUCT('kind','document_span','id',a.assertion_id))) AS claim
      FROM TABLE(FLATTEN(input=>:IDS)) i JOIN SAARTHI.EVIDENCE.ASSERTION a
        ON a.assertion_id=i.value::VARCHAR
      JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id=a.doc_id
      JOIN SAARTHI.DOCUMENTS.DOC_PAGE dp ON dp.doc_id=a.doc_id AND dp.page_index=a.page_index
     WHERE d.patient_id=:v_patient AND d.scope='patient' AND d.status='active'
       AND d.ingested_at<=TRY_TO_TIMESTAMP_NTZ(:KNOWN_AS_OF)
       AND a.verification_status='verified'
       AND a.missingness_state IN ('present','explicitly_negative')
       AND a.char_start>=0 AND a.char_end>a.char_start AND a.char_end<=LENGTH(dp.text)
       AND a.char_end-a.char_start<=4000
    UNION ALL
    SELECT DISTINCT i.value::VARCHAR AS id,OBJECT_CONSTRUCT('text','Recorded SQL source',
        'claim_type','textual','evidence',ARRAY_CONSTRUCT(
            OBJECT_CONSTRUCT('kind','structured','id',i.value::VARCHAR))) AS claim
      FROM TABLE(FLATTEN(input=>:IDS)) i
     WHERE REGEXP_LIKE(i.value::VARCHAR,
        '(ROW-(PATIENT|COVERAGE|PLAN|ENCOUNTER|IDENTITY)--[A-Za-z0-9_-]+'
        || '|RULE--[A-Za-z0-9_-]+--[A-Za-z0-9_-]+--[1-9][0-9]*)')
    UNION ALL
    SELECT DISTINCT c.chunk_id AS id,OBJECT_CONSTRUCT('text','Reference source passage',
        'claim_type','textual','evidence',ARRAY_CONSTRUCT(
            OBJECT_CONSTRUCT('kind','reference_clause','id',c.chunk_id))) AS claim
      FROM TABLE(FLATTEN(input=>:IDS)) i
      JOIN SAARTHI.DOCUMENTS.DOC_CHUNK c ON c.chunk_id=i.value::VARCHAR
     WHERE c.doc_scope='reference' AND c.patient_id IS NULL);
    RETURN OBJECT_CONSTRUCT('claims',ARRAY_SLICE(v_claims,0,16));
END;
$$;
