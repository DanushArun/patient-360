-- Internal canonical row quotations; caller scope is resolved by VALIDATE_ANSWER.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RECORD(
    CLAIM VARIANT, KNOWN_AS_OF VARCHAR, SCOPE_CONTEXT VARIANT)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_domain VARCHAR DEFAULT SPLIT_PART(CLAIM:evidence[0]:id::VARCHAR,'--',1);
    v_key VARCHAR DEFAULT SPLIT_PART(CLAIM:evidence[0]:id::VARCHAR,'--',2);
    v_patient VARCHAR DEFAULT SCOPE_CONTEXT:patient_id::VARCHAR;
    v_clock TIMESTAMP_TZ DEFAULT TRY_TO_TIMESTAMP_TZ(KNOWN_AS_OF || '+00:00');
    v_rows ARRAY;
    v_row VARIANT;
    v_claim VARIANT;
BEGIN
    IF (v_domain='RULE') THEN
        v_claim := (CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RULE(:CLAIM,:KNOWN_AS_OF));
        RETURN v_claim;
    END IF;
    IF (v_clock IS NULL OR v_patient IS NULL OR CLAIM:claim_type::VARCHAR!='textual') THEN
        RETURN OBJECT_CONSTRUCT('error','invalid_record_claim');
    END IF;
    LET v_required_category VARCHAR := CASE v_domain
        WHEN 'ROW-COVERAGE' THEN 'financial'
        WHEN 'ROW-PATIENT' THEN 'identity' WHEN 'ROW-IDENTITY' THEN 'identity'
        ELSE 'clinical' END;
    IF (NOT COALESCE(ARRAY_CONTAINS(TO_VARIANT(v_required_category),
        SCOPE_CONTEXT:categories::ARRAY),FALSE)) THEN
        RETURN OBJECT_CONSTRUCT('error',IFF(v_required_category='financial',
            'financial_consent_required','record_category_consent_required'));
    END IF;
    CASE (v_domain)
        WHEN 'ROW-PATIENT' THEN
            SELECT ARRAY_AGG(OBJECT_CONSTRUCT('table','SAARTHI.CORE.PATIENT',
                'facts',OBJECT_CONSTRUCT(
                    'patient_id',COALESCE(TO_VARIANT(patient_id),TO_VARIANT('not_received')),
                    'name',COALESCE(TO_VARIANT(name),TO_VARIANT('not_received')),
                    'dob',COALESCE(TO_VARIANT(dob),TO_VARIANT('not_received')),
                    'gender',COALESCE(TO_VARIANT(gender),TO_VARIANT('not_received')),
                    'district',COALESCE(TO_VARIANT(district),TO_VARIANT('not_received')),
                    'state',COALESCE(TO_VARIANT(state),TO_VARIANT('not_received')),
                    'primary_language',COALESCE(TO_VARIANT(primary_language),
                        TO_VARIANT('not_received'))),
                'event_time',COALESCE(TO_VARCHAR(created_at),'not_received'),
                'source_recorded_at','not_received',
                'ingested_at','not_received'))
              INTO :v_rows FROM SAARTHI.CORE.PATIENT AT(TIMESTAMP => :v_clock)
             WHERE patient_id=:v_patient AND patient_id=:v_key;
        WHEN 'ROW-COVERAGE' THEN
            SELECT ARRAY_AGG(OBJECT_CONSTRUCT('table','SAARTHI.CORE.COVERAGE',
                'facts',OBJECT_CONSTRUCT(
                    'payer_name',COALESCE(TO_VARIANT(payer_name),TO_VARIANT('not_received')),
                    'annual_limit',COALESCE(TO_VARIANT(annual_limit),TO_VARIANT('not_received')),
                    'used_amount',COALESCE(TO_VARIANT(used_amount),TO_VARIANT('not_received')),
                    'is_family_floater',COALESCE(TO_VARIANT(is_family_floater),
                        TO_VARIANT('not_received')),
                    'effective_from',COALESCE(TO_VARIANT(effective_from),
                        TO_VARIANT('not_received')),
                    'effective_to',COALESCE(TO_VARIANT(effective_to),TO_VARIANT('not_received'))),
                'event_time',COALESCE(TO_VARCHAR(effective_from),'not_received'),
                'source_recorded_at','not_received',
                'ingested_at','not_received'))
              INTO :v_rows FROM SAARTHI.CORE.COVERAGE AT(TIMESTAMP => :v_clock)
             WHERE patient_id=:v_patient AND coverage_id=:v_key;
        WHEN 'ROW-PLAN' THEN
            SELECT ARRAY_AGG(OBJECT_CONSTRUCT('table','SAARTHI.CORE.TREATMENT_PLAN',
                'facts',OBJECT_CONSTRUCT(
                    'version',COALESCE(TO_VARIANT(version),TO_VARIANT('not_received')),
                    'regimen_display',COALESCE(TO_VARIANT(regimen_display),
                        TO_VARIANT('not_received')),
                    'intent',COALESCE(TO_VARIANT(intent),TO_VARIANT('not_received')),
                    'decided_at',COALESCE(TO_VARIANT(decided_at),TO_VARIANT('not_received'))),
                'event_time',COALESCE(TO_VARCHAR(decided_at),'not_received'),
                'source_recorded_at','not_received',
                'ingested_at','not_received'))
              INTO :v_rows FROM SAARTHI.CORE.TREATMENT_PLAN AT(TIMESTAMP => :v_clock)
             WHERE patient_id=:v_patient AND plan_id=:v_key;
        WHEN 'ROW-ENCOUNTER' THEN
            SELECT ARRAY_AGG(OBJECT_CONSTRUCT('table','SAARTHI.CORE.ENCOUNTER',
                'facts',OBJECT_CONSTRUCT(
                    'encounter_id',COALESCE(TO_VARIANT(encounter_id),TO_VARIANT('not_received')),
                    'cycle_number',COALESCE(TO_VARIANT(cycle_number),TO_VARIANT('not_received')),
                    'event_time',COALESCE(TO_VARIANT(event_time),TO_VARIANT('not_received')),
                    'gap_type',COALESCE(TO_VARIANT(gap_type),TO_VARIANT('not_received')),
                    'status',COALESCE(TO_VARIANT(status),TO_VARIANT('not_received'))),
                'event_time',COALESCE(TO_VARCHAR(event_time),'not_received'),
                'source_recorded_at','not_received',
                'ingested_at',COALESCE(TO_VARCHAR(ingested_at),'not_received')))
              INTO :v_rows FROM SAARTHI.CORE.ENCOUNTER AT(TIMESTAMP => :v_clock)
             WHERE patient_id=:v_patient AND encounter_id=:v_key;
        WHEN 'ROW-IDENTITY' THEN
            SELECT ARRAY_AGG(OBJECT_CONSTRUCT('table','SAARTHI.CORE.ID_MAP',
                'facts',OBJECT_CONSTRUCT(
                    'source_system',COALESCE(TO_VARIANT(source_system),TO_VARIANT('not_received')),
                    'link_status',COALESCE(TO_VARIANT(link_status),TO_VARIANT('not_received')),
                    'linked_at',COALESCE(TO_VARIANT(linked_at),TO_VARIANT('not_received'))),
                'event_time',COALESCE(TO_VARCHAR(linked_at),'not_received'),
                'source_recorded_at','not_received',
                'ingested_at','not_received'))
              INTO :v_rows FROM SAARTHI.CORE.ID_MAP AT(TIMESTAMP => :v_clock)
             WHERE patient_id=:v_patient AND map_id=:v_key
               AND link_status IN ('abha_linked','manually_verified');
        ELSE RETURN OBJECT_CONSTRUCT('error','invalid_record_identifier');
    END CASE;
    IF (COALESCE(ARRAY_SIZE(v_rows),0)!=1) THEN
        RETURN OBJECT_CONSTRUCT('error','record_not_available');
    END IF;
    v_row := GET(v_rows,0);
    v_claim := OBJECT_CONSTRUCT('text','Recorded SQL row: ' || TO_JSON(v_row:facts),
        'claim_type','textual','evidence',ARRAY_CONSTRUCT(OBJECT_CONSTRUCT(
            'kind','structured','id',CLAIM:evidence[0]:id,'table',v_row:table,
            'event_time',v_row:event_time,'source_recorded_at',v_row:source_recorded_at,
            'ingested_at',v_row:ingested_at)));
    RETURN OBJECT_CONSTRUCT('claim',v_claim,'limitations',ARRAY_CONSTRUCT(
        'Source clocks absent from the originating row remain not_received.',
        'SQL row is quoted at the requested database snapshot; it is not clinical clearance.'));
EXCEPTION WHEN STATEMENT_ERROR THEN
    RETURN OBJECT_CONSTRUCT('error','record_snapshot_unavailable');
END;
$$;
