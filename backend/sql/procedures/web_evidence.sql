-- Pointer-only answer audit, re-authorized in the same patient binding as the answer.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.RECORD_WEB_ANSWER(QUESTION VARCHAR, AS_OF VARCHAR, EVIDENCE_IDS ARRAY, RUN_REF VARCHAR, ANSWER_STATE VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS $$
DECLARE KNOWN_AS_OF VARCHAR DEFAULT NULL;
v_known_as_of TIMESTAMP_NTZ; v_known_as_of_s VARCHAR; v_binding_id VARCHAR;
v_patient_id VARCHAR; v_practitioner VARCHAR; v_care_team_id VARCHAR; v_consent_id VARCHAR;
v_class VARIANT; v_ids ARRAY; v_id VARCHAR; v_status VARCHAR;
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
IF (QUESTION IS NULL OR LENGTH(QUESTION)>4000 OR RUN_REF IS NULL OR LENGTH(RUN_REF)>80 OR ARRAY_SIZE(EVIDENCE_IDS)>100) THEN RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
v_class := (CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION(:QUESTION));
IF (v_class:classification::VARCHAR NOT IN ('CLASS_A','CLASS_B') OR v_class:classification IS NULL) THEN RETURN OBJECT_CONSTRUCT('error','classification_unavailable'); END IF;
v_known_as_of := COALESCE(TRY_TO_TIMESTAMP_NTZ(:AS_OF),v_known_as_of);
SELECT COALESCE(ARRAY_AGG(DISTINCT id),ARRAY_CONSTRUCT()) INTO :v_ids FROM (
 SELECT e.event_id AS id FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS e WHERE e.patient_id=:v_patient_id AND e.ingested_at<=:v_known_as_of AND ARRAY_CONTAINS(e.event_id::VARIANT,:EVIDENCE_IDS)
 UNION
 SELECT a.assertion_id FROM SAARTHI.EVIDENCE.ASSERTION a JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id=a.doc_id
 WHERE d.patient_id=:v_patient_id AND d.scope='patient' AND d.status='active' AND d.ingested_at<=:v_known_as_of
 AND a.verification_status='verified' AND ARRAY_CONTAINS(a.assertion_id::VARIANT,:EVIDENCE_IDS)
);
v_status := CASE WHEN v_class:classification::VARCHAR='CLASS_A' THEN 'refused' WHEN ANSWER_STATE='error' THEN 'error' ELSE 'recorded' END;
IF (EXISTS (SELECT 1 FROM SAARTHI.EVIDENCE.ANSWER_RUN WHERE run_id=:RUN_REF AND (patient_id!=:v_patient_id OR practitioner_id!=:v_practitioner))) THEN RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
MERGE INTO SAARTHI.EVIDENCE.ANSWER_RUN t USING (SELECT :RUN_REF AS id) s ON t.run_id=s.id
WHEN NOT MATCHED THEN INSERT(run_id,question_class,practitioner_id,patient_id,consent_id,known_as_of,answer_status,evidence_ids,model_version,validation_results)
VALUES(s.id,IFF(:v_class:classification::VARCHAR='CLASS_A','A','B'),:v_practitioner,:v_patient_id,:v_consent_id,:v_known_as_of,:v_status,:v_ids,'web-source-pointers@1',OBJECT_CONSTRUCT('pointers_scope_checked',TRUE,'answer_text_retained',FALSE,'does_not_attest_model_prose',TRUE));
RETURN OBJECT_CONSTRUCT('run_id',RUN_REF,'status',v_status);
END;
$$;

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.PREPARE_WEB_PACKET(QUESTION VARCHAR, PACKET_REF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS $$
DECLARE KNOWN_AS_OF VARCHAR DEFAULT NULL;
v_known_as_of TIMESTAMP_NTZ; v_known_as_of_s VARCHAR; v_binding_id VARCHAR;
v_patient_id VARCHAR; v_practitioner VARCHAR; v_care_team_id VARCHAR; v_consent_id VARCHAR;
v_class VARIANT; v_recipient VARCHAR; v_name VARCHAR; v_gates VARIANT; v_ids ARRAY;
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
IF (QUESTION IS NULL OR LENGTH(QUESTION)>4000 OR PACKET_REF IS NULL OR LENGTH(PACKET_REF)>80) THEN RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
IF (NOT EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM WHERE care_team_id=:v_care_team_id AND role_type IN ('treating','coordinator'))) THEN RETURN OBJECT_CONSTRUCT('error','no_patient_access'); END IF;
v_class := (CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION(:QUESTION));
IF (COALESCE(v_class:classification::VARCHAR,'')!='CLASS_A') THEN RETURN OBJECT_CONSTRUCT('error','clinical_referral_only'); END IF;
SELECT p.practitioner_id,p.name INTO :v_recipient,:v_name FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
JOIN SAARTHI.GOVERNANCE.PRACTITIONER p ON p.practitioner_id=ct.practitioner_id
WHERE ct.patient_id=:v_patient_id AND ct.role_type='treating' AND p.active=TRUE
AND ct.active_from<=CURRENT_DATE() AND (ct.active_to IS NULL OR ct.active_to>=CURRENT_DATE())
ORDER BY ct.active_from DESC,p.practitioner_id LIMIT 1;
IF (v_recipient IS NULL) THEN RETURN OBJECT_CONSTRUCT('error','treating_practitioner_unavailable'); END IF;
IF (EXISTS (SELECT 1 FROM SAARTHI.EVIDENCE.EVIDENCE_PACKET WHERE packet_id=:PACKET_REF AND (patient_id!=:v_patient_id OR created_by_practitioner_id!=:v_practitioner))) THEN RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
v_gates := (CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL,NULL));
IF (v_gates:error IS NOT NULL OR NOT IS_ARRAY(v_gates:gates)) THEN RETURN OBJECT_CONSTRUCT('error','readiness_unavailable'); END IF;
SELECT COALESCE(ARRAY_AGG(DISTINCT e.value::VARCHAR),ARRAY_CONSTRUCT()) INTO :v_ids
FROM TABLE(FLATTEN(input=>:v_gates:gates)) g,LATERAL FLATTEN(input=>g.value:evidence_ids) e;
MERGE INTO SAARTHI.EVIDENCE.EVIDENCE_PACKET t USING (SELECT :PACKET_REF AS id) s ON t.packet_id=s.id
WHEN NOT MATCHED THEN INSERT(packet_id,patient_id,question,created_by_practitioner_id,evidence_ids,gate_snapshot,consent_id,delivered_to_practitioner_id,delivered_at)
VALUES(s.id,:v_patient_id,:QUESTION,:v_practitioner,:v_ids,:v_gates,:v_consent_id,:v_recipient,NULL);
RETURN OBJECT_CONSTRUCT('packet_id',PACKET_REF,'practitioner_name',v_name,'status','prepared','known_as_of',v_gates:known_as_of,'delivered',FALSE);
END;
$$;
