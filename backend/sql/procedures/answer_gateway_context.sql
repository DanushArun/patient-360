-- Collect on the gateway's bound session; corpora retain separate named result lists.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CONTEXT(
    QUESTION VARCHAR, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_sections ARRAY DEFAULT ARRAY_CONSTRUCT('readiness');
    v_index INTEGER DEFAULT 0;
    v_name VARCHAR; v_section VARIANT; v_packet VARIANT; v_context VARIANT;
    v_latest_labs ARRAY; v_access VARIANT; v_clock VARCHAR;
BEGIN
    -- Keep the governed packet small enough for a bounded model call. Each
    -- section is still selected server side; the question only narrows which
    -- deterministic reads are needed.
    IF (REGEXP_LIKE(LOWER(COALESCE(QUESTION,'')),
        'lab|anc|platelet|haemoglobin|hemoglobin|ki[- ]?67|biomarker')) THEN
        v_sections := ARRAY_APPEND(v_sections,'labs');
    END IF;
    IF (REGEXP_LIKE(LOWER(COALESCE(QUESTION,'')),
        'encounter|visit|appointment|admission|discharge')) THEN
        v_sections := ARRAY_APPEND(v_sections,'encounters');
    END IF;
    IF (REGEXP_LIKE(LOWER(COALESCE(QUESTION,'')),
        'coverage|authori[sz]|insurance|pre[- ]?author')) THEN
        v_sections := ARRAY_APPEND(v_sections,'coverage');
    END IF;
    IF (REGEXP_LIKE(LOWER(COALESCE(QUESTION,'')),
        'treatment|regimen|medication|dose|cycle')) THEN
        v_sections := ARRAY_APPEND(v_sections,'treatment_plan');
    END IF;
    IF (REGEXP_LIKE(LOWER(COALESCE(QUESTION,'')),
        'document|report|scan|pathology|record')) THEN
        v_sections := ARRAY_APPEND(v_sections,'patient_documents');
    END IF;
    v_access := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),:KNOWN_AS_OF));
    IF (v_access:error IS NOT NULL) THEN RETURN v_access; END IF;
    v_clock := v_access:known_as_of::VARCHAR;
    v_packet := OBJECT_CONSTRUCT('access_scope',v_access:access_scope);
    WHILE (v_index<ARRAY_SIZE(v_sections)) DO
        v_name := v_sections[v_index]::VARCHAR;
        v_section := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CONTEXT_SECTION(
            :v_name,:QUESTION,:v_clock));
        IF (v_name='labs' AND v_section:error IS NULL) THEN
            SELECT COALESCE(ARRAY_AGG(value),ARRAY_CONSTRUCT()) INTO :v_latest_labs FROM (
                SELECT value,ROW_NUMBER() OVER (PARTITION BY value:concept::VARCHAR
                    ORDER BY value:event_time::TIMESTAMP_NTZ DESC NULLS LAST,
                    value:ingested_at::TIMESTAMP_NTZ DESC NULLS LAST,value:event_id::VARCHAR DESC)
                    AS record_rank FROM TABLE(FLATTEN(INPUT=>:v_section:facts))
            ) WHERE record_rank=1;
            v_section := OBJECT_INSERT(v_section,'facts',v_latest_labs,TRUE);
        END IF;
        v_packet := OBJECT_INSERT(v_packet,v_name,v_section,TRUE);
        v_index := v_index+1;
    END WHILE;
    v_context := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CONTEXT_PACK(:v_packet,:v_clock));
    RETURN v_context;
EXCEPTION WHEN STATEMENT_ERROR THEN
    RETURN OBJECT_CONSTRUCT('error','context_dependency_unavailable',
        'known_as_of',COALESCE(v_clock,KNOWN_AS_OF));
END;
$$;
