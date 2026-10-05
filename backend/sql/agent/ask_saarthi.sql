-- Sole answer gateway; final consent-scope verification also protects direct MCP callers.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ASK_SAARTHI(QUESTION VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_clock VARCHAR;
    v_access VARIANT;
    v_final_access VARIANT;
    v_class VARIANT;
    v_answer VARIANT;
BEGIN
    v_clock := TO_VARCHAR(CURRENT_TIMESTAMP()::TIMESTAMP_NTZ,'YYYY-MM-DD"T"HH24:MI:SS');
    IF (QUESTION IS NULL OR LENGTH(TRIM(QUESTION))=0 OR LENGTH(QUESTION)>4000) THEN
        RETURN OBJECT_CONSTRUCT('error','invalid_argument','known_as_of',v_clock);
    END IF;
    v_access := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),:v_clock));
    IF (v_access:error IS NOT NULL) THEN RETURN v_access; END IF;
    IF (NOT COALESCE(REGEXP_LIKE(v_access:access_scope::VARCHAR,'^[a-f0-9]{64}$'),FALSE)) THEN
        RETURN OBJECT_CONSTRUCT('error','answer_gateway_unavailable','known_as_of',v_clock);
    END IF;
    v_class := (CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION(:QUESTION));
    IF (COALESCE(v_class:classification::VARCHAR,'') NOT IN ('CLASS_A','CLASS_B')) THEN
        RETURN OBJECT_CONSTRUCT('error','classification_unavailable','known_as_of',v_clock);
    END IF;
    IF (v_class:classification::VARCHAR='CLASS_A') THEN
        v_answer := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_REFUSAL(:v_clock));
    ELSE
        v_answer := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_INFER(:QUESTION,:v_clock));
    END IF;
    v_final_access := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),NULL));
    IF (v_final_access:error IS NOT NULL) THEN RETURN v_final_access; END IF;
    IF (v_final_access:access_scope IS DISTINCT FROM v_access:access_scope) THEN
        RETURN OBJECT_CONSTRUCT('error','access_scope_changed','known_as_of',v_clock);
    END IF;
    RETURN v_answer;
EXCEPTION WHEN OTHER THEN
    RETURN OBJECT_CONSTRUCT('error','answer_gateway_unavailable','known_as_of',v_clock);
END;
$$;
