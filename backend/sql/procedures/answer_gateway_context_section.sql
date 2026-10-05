-- Each optional context dependency fails independently, without exposing error details.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CONTEXT_SECTION(
    SECTION VARCHAR, QUESTION VARCHAR, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE v_result VARIANT;
BEGIN
    IF (SECTION IN ('labs','coverage','identity','demographics','treatment_plan','encounters')) THEN
        v_result := (CALL SAARTHI.OPERATIONAL.GET_PATIENT_FACTS(:SECTION,:KNOWN_AS_OF));
    ELSEIF (SECTION='readiness') THEN
        v_result := (CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL,:KNOWN_AS_OF));
    ELSEIF (SECTION='patient_documents') THEN
        v_result := (CALL SAARTHI.OPERATIONAL.SEARCH_PATIENT_DOCUMENTS(
            LEFT(:QUESTION,1000),:KNOWN_AS_OF));
    ELSEIF (SECTION='reference_documents') THEN
        v_result := (CALL SAARTHI.OPERATIONAL.SEARCH_REFERENCE_DOCUMENTS(
            LEFT(:QUESTION,1000),NULL,NULL));
    ELSE
        RETURN OBJECT_CONSTRUCT('error','invalid_argument','known_as_of',KNOWN_AS_OF);
    END IF;
    RETURN v_result;
EXCEPTION WHEN STATEMENT_ERROR THEN
    RETURN OBJECT_CONSTRUCT('error','section_dependency_unavailable','known_as_of',KNOWN_AS_OF);
END;
$$;
