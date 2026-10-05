-- Offers preparation only. Packet creation and delivery are separate explicit operations.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_REFUSAL(KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_access VARIANT;
    v_recipient VARIANT;
BEGIN
    v_access := (CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),:KNOWN_AS_OF));
    IF (v_access:error IS NOT NULL) THEN RETURN v_access; END IF;
    SELECT OBJECT_CONSTRUCT('practitioner_id',p.practitioner_id,'name',p.name,
        'nmc_registration_no',p.nmc_registration_no) INTO :v_recipient
      FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
      JOIN SAARTHI.GOVERNANCE.PRACTITIONER p ON p.practitioner_id=ct.practitioner_id
     WHERE ct.patient_id=(SELECT patient_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
         WHERE session_id=CURRENT_SESSION() AND released_at IS NULL
         ORDER BY bound_at DESC LIMIT 1)
       AND ct.role_type='treating' AND p.active=TRUE
       AND ct.active_from<=CURRENT_DATE()
       AND (ct.active_to IS NULL OR ct.active_to>=CURRENT_DATE())
       AND NULLIF(TRIM(p.name),'') IS NOT NULL
       AND NULLIF(TRIM(p.nmc_registration_no),'') IS NOT NULL
     ORDER BY ct.active_from DESC,p.practitioner_id LIMIT 1;
    IF (v_recipient IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error','treating_practitioner_unavailable',
            'known_as_of',KNOWN_AS_OF);
    END IF;
    RETURN OBJECT_CONSTRUCT('classification','CLASS_A','claims',ARRAY_CONSTRUCT(),
        'limitations',ARRAY_CONSTRUCT(),'overall_status','refused','known_as_of',KNOWN_AS_OF,
        'refusal',OBJECT_CONSTRUCT('reason_code','class_a_clinical_judgment',
            'message','Clinical judgment requires the named treating practitioner.',
            'practitioner',v_recipient,'evidence_packet_offered',TRUE));
END;
$$;
