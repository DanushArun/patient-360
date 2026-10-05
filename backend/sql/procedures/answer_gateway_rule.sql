-- Internal adapter for versioned SQL record checks; never accepts model conclusions.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RULE(
    CLAIM VARIANT, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_id VARCHAR DEFAULT CLAIM:evidence[0]:id::VARCHAR;
    v_encounter VARCHAR DEFAULT SPLIT_PART(v_id,'--',2);
    v_rule VARCHAR DEFAULT SPLIT_PART(v_id,'--',3);
    v_version INTEGER DEFAULT TRY_TO_NUMBER(SPLIT_PART(v_id,'--',4));
    v_readiness VARIANT;
    v_matches ARRAY;
    v_gate VARIANT;
    v_category VARCHAR;
    v_allowed BOOLEAN;
    v_note VARCHAR;
BEGIN
    IF (CLAIM:claim_type::VARCHAR!='textual' OR ARRAY_SIZE(SPLIT(v_id,'--'))!=4
        OR NOT REGEXP_LIKE(v_id,'RULE--[A-Za-z0-9_-]+--[A-Za-z0-9_-]+--[1-9][0-9]*')) THEN
        RETURN OBJECT_CONSTRUCT('error','invalid_rule_identifier');
    END IF;
    v_readiness := (CALL SAARTHI.OPERATIONAL.GET_READINESS(:v_encounter,:KNOWN_AS_OF));
    IF (v_readiness:error IS NOT NULL) THEN RETURN v_readiness; END IF;
    SELECT ARRAY_AGG(value) INTO :v_matches FROM TABLE(FLATTEN(INPUT=>:v_readiness:gates))
     WHERE value:rule_id::VARCHAR=:v_rule AND value:rule_version::INTEGER=:v_version;
    IF (COALESCE(ARRAY_SIZE(v_matches),0)!=1) THEN
        RETURN OBJECT_CONSTRUCT('error','rule_not_available');
    END IF;
    v_gate := GET(v_matches,0);
    v_category := CASE v_gate:gate::VARCHAR
        WHEN 'coverage' THEN 'financial' WHEN 'identity' THEN 'identity'
        ELSE 'clinical' END;
    SELECT ARRAY_CONTAINS(TO_VARIANT(:v_category),data_categories) INTO :v_allowed
      FROM SAARTHI.GOVERNANCE.CONSENT
     WHERE consent_id=:v_readiness:consent_id::VARCHAR AND status='active'
       AND valid_from<=CURRENT_TIMESTAMP()
       AND (valid_until IS NULL OR valid_until>=CURRENT_TIMESTAMP());
    IF (NOT COALESCE(v_allowed,FALSE)) THEN
        RETURN OBJECT_CONSTRUCT('error','rule_category_consent_required');
    END IF;
    SELECT COALESCE(provenance_note,'Rule provenance note not_received') INTO :v_note
      FROM SAARTHI.OPERATIONAL.RULE_CATALOG
     WHERE rule_id=:v_rule AND rule_version=:v_version;
    IF (v_note IS NULL OR v_gate:outcome::VARCHAR NOT IN
        ('pass','fail','not_evaluated','conflicting')) THEN
        RETURN OBJECT_CONSTRUCT('error','rule_not_available');
    END IF;
    RETURN OBJECT_CONSTRUCT('claim',OBJECT_CONSTRUCT(
        'text','SQL record check ' || v_rule || ' version ' || TO_VARCHAR(v_version)
            || ': ' || v_gate:outcome::VARCHAR || '. This is not treatment clearance.',
        'claim_type','textual','gate',v_gate:gate,'outcome',v_gate:outcome,
        'rule_id',v_rule,'rule_version',v_version,'provenance_note',v_note,
        'evidence',ARRAY_CONSTRUCT(OBJECT_CONSTRUCT(
            'kind','structured','id',v_id,'table','SAARTHI.OPERATIONAL.RULE_CATALOG',
            'event_time','not_received','source_recorded_at','not_received',
            'ingested_at','not_received',
            'derived','GET_READINESS at ' || KNOWN_AS_OF || '; source IDs '
                || TO_JSON(v_gate:evidence_ids)))),
        'limitations',ARRAY_CONSTRUCT(
            'Rule source clocks are not_received; the displayed version is explicit.',
            'A rule outcome describes recorded evidence, never a clinical decision.'));
EXCEPTION WHEN STATEMENT_ERROR THEN
    RETURN OBJECT_CONSTRUCT('error','rule_dependency_unavailable');
END;
$$;
