-- Private inference adapter; callers must authorize and classify before invoking it.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_INFER(
    QUESTION VARCHAR, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_payload VARCHAR;
    v_context VARIANT;
    v_access VARIANT;
    v_result VARCHAR;
    v_candidate VARIANT;
    v_answer VARIANT;
BEGIN
    v_context := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CONTEXT(:QUESTION,:KNOWN_AS_OF));
    IF (v_context:error IS NOT NULL) THEN RETURN v_context; END IF;
    v_access := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),NULL));
    IF (v_access:error IS NOT NULL) THEN RETURN v_access; END IF;
    IF (v_access:access_scope IS DISTINCT FROM v_context:access_scope) THEN
        RETURN OBJECT_CONSTRUCT('error','access_scope_changed','known_as_of',KNOWN_AS_OF);
    END IF;
    v_payload := TO_JSON(OBJECT_CONSTRUCT('messages',ARRAY_CONSTRUCT(
        OBJECT_CONSTRUCT('role','user','content',ARRAY_CONSTRUCT(
            OBJECT_CONSTRUCT('type','text','text',QUESTION
                || '\nSQL_CONTEXT: ' || TO_JSON(v_context)
                || '\nReturn only JSON with claims. Use provided exact evidence IDs. '
                || 'Claims: text,claim_type,evidence[{kind,id}],asserted_value for typed values. '
                || 'Dates: YYYY-MM-DD. No clinical judgments. Empty: claims=[].'))))));
    BEGIN
        v_result := (SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(
            'SAARTHI.OPERATIONAL.SAARTHI_AGENT',:v_payload));
    EXCEPTION
        WHEN OTHER THEN v_result := '{"error":"agent_dependency_unavailable"}';
    END;
    IF (TRY_PARSE_JSON(v_result):code::VARCHAR='399504'
        OR TRY_PARSE_JSON(v_result):error::VARCHAR='agent_dependency_unavailable') THEN
        v_answer := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RECORD_FALLBACK(
            :QUESTION,:KNOWN_AS_OF));
        RETURN v_answer;
    END IF;
    v_candidate := COALESCE(TRY_PARSE_JSON(v_result),OBJECT_CONSTRUCT(
        'content',ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('type','text','text',v_result))));
    v_answer := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_FINALIZE(
        :v_candidate,:KNOWN_AS_OF));
    RETURN v_answer;
END;
$$;
