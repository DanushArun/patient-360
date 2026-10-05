-- Bounded record lookup for an unavailable agent. No narrative or clinical conclusions.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RECORD_FALLBACK(
    QUESTION VARCHAR, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_access VARIANT;
    v_patient VARCHAR;
    v_ids VARCHAR;
    v_answer VARIANT;
    v_payload VARIANT;
BEGIN
    v_access := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),:KNOWN_AS_OF));
    IF (v_access:error IS NOT NULL) THEN RETURN v_access; END IF;
    SELECT patient_id INTO :v_patient FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
     WHERE session_id=CURRENT_SESSION() AND released_at IS NULL ORDER BY bound_at DESC LIMIT 1;
    SELECT COALESCE(LISTAGG(event_id,' '),'') INTO :v_ids FROM (
        SELECT event_id FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS
         WHERE patient_id=:v_patient AND ingested_at<=TRY_TO_TIMESTAMP_NTZ(:KNOWN_AS_OF)
           AND ((concept_name='PLT' AND REGEXP_LIKE(:QUESTION,'(^|.*[^a-z])(platelets?|plt)([^a-z].*|$)','i'))
             OR (concept_name='ANC' AND REGEXP_LIKE(:QUESTION,'(^|.*[^a-z])(absolute neutrophil count|anc)([^a-z].*|$)','i'))
             OR (concept_name='WBC' AND REGEXP_LIKE(:QUESTION,'(^|.*[^a-z])(white blood cell count|wbc)([^a-z].*|$)','i')))
         QUALIFY ROW_NUMBER() OVER (PARTITION BY concept_name ORDER BY event_time DESC,
             source_recorded_at DESC,ingested_at DESC,event_id)=1);
    v_payload := OBJECT_CONSTRUCT('content',ARRAY_CONSTRUCT(
        OBJECT_CONSTRUCT('type','text','text',v_ids)));
    v_answer := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_FINALIZE(:v_payload,:KNOWN_AS_OF));
    IF (v_answer:error IS NOT NULL) THEN RETURN v_answer; END IF;
    RETURN OBJECT_INSERT(v_answer,'limitations',ARRAY_APPEND(v_answer:limitations::ARRAY,
        'The agent dependency was unavailable. Only explicit SQL lab record lookups are shown.'),TRUE);
END;
$$;
