CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_FINALIZE(
    PAYLOAD VARIANT, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_candidate VARIANT;
    v_checked VARIANT;
    v_legacy BOOLEAN;
    v_claims VARIANT;
    v_limitations ARRAY;
BEGIN
    v_candidate := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CANDIDATES(:PAYLOAD));
    IF (v_candidate:error IS NOT NULL) THEN
        RETURN OBJECT_CONSTRUCT('error','invalid_candidate','known_as_of',KNOWN_AS_OF);
    END IF;
    v_legacy := v_candidate:mode::VARCHAR='legacy';
    IF (v_legacy) THEN
        v_candidate := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RESOLVE_IDS(
            :v_candidate:ids::ARRAY,:KNOWN_AS_OF));
        IF (v_candidate:error IS NOT NULL) THEN RETURN v_candidate; END IF;
    END IF;
    v_claims := v_candidate:claims;
    v_checked := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(:v_claims,:KNOWN_AS_OF));
    IF (v_checked:error IS NOT NULL) THEN RETURN v_checked; END IF;
    v_limitations := v_checked:limitations::ARRAY;
    IF (v_legacy OR ARRAY_SIZE(v_checked:claims)=0) THEN
        v_limitations := ARRAY_APPEND(v_limitations,
            'Only verified cited source records are shown; no narrative conclusion was accepted.');
    END IF;
    RETURN OBJECT_CONSTRUCT('classification','CLASS_B','claims',v_checked:claims,
        'rule_versions',COALESCE(v_checked:rule_versions,OBJECT_CONSTRUCT()),
        'limitations',v_limitations,'known_as_of',KNOWN_AS_OF,
        'overall_status',IFF(v_legacy,'partial',v_checked:overall_status::VARCHAR));
END;
$$;
