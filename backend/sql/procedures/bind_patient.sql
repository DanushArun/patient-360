-- =============================================================================
-- STEP 14 - bind_patient (internal - never exposed to the agent)
-- =============================================================================
-- COPILOT-SPEC.md §0. Selection is a human click, recorded, re-validated on
-- every tool call. Validates CARE_TEAM + CONSENT BEFORE writing - any
-- failure raises, no binding is created, no detail about why is returned.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.bind_patient(p_patient_id VARCHAR)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 procedure 9. Validates care team + consent before writing. Not an agent tool.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_practitioner  VARCHAR;
    v_care_team_id  VARCHAR;
    v_consent_id    VARCHAR;
    v_binding_id    VARCHAR;
BEGIN
    -- 1. resolve CURRENT_USER() -> PRACTITIONER
    v_practitioner := (SELECT practitioner_id
                         FROM SAARTHI.GOVERNANCE.PRACTITIONER
                        WHERE snowflake_user = CURRENT_USER()
                          AND active = TRUE);
    IF (v_practitioner IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;

    -- 2. require an ACTIVE CARE_TEAM row for (practitioner, p_patient_id) today
    v_care_team_id := (SELECT care_team_id
                         FROM SAARTHI.GOVERNANCE.CARE_TEAM
                        WHERE practitioner_id = :v_practitioner
                          AND patient_id     = :p_patient_id
                          AND active_from   <= CURRENT_DATE()
                          AND (active_to IS NULL OR active_to >= CURRENT_DATE())
                        ORDER BY active_from DESC
                        LIMIT 1);
    IF (v_care_team_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;

    -- 3. require a valid CONSENT covering purpose and today's date
    v_consent_id := (SELECT c.consent_id
                       FROM SAARTHI.GOVERNANCE.CONSENT c
                       JOIN SAARTHI.GOVERNANCE.PRACTITIONER p
                         ON p.practitioner_id = :v_practitioner
                       LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f
                         ON f.facility_id = p.facility_id
                      WHERE c.patient_id = :p_patient_id
                        AND c.status     = 'active'
                        AND c.valid_from <= CURRENT_TIMESTAMP()
                        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                        AND c.purpose_code IN ('treatment', 'coordination')
                        AND (c.granted_to_facility_id = p.facility_id
                          OR c.granted_to_org_id      = f.org_id)
                      ORDER BY c.valid_from DESC
                      LIMIT 1);
    IF (v_consent_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'consent_not_valid');
    END IF;

    -- 4. release any prior binding for CURRENT_SESSION()
    UPDATE SAARTHI.GOVERNANCE.PATIENT_BINDING
       SET released_at = CURRENT_TIMESTAMP()
     WHERE session_id = CURRENT_SESSION()
       AND released_at IS NULL;

    -- 5. insert the new binding, return binding_id
    v_binding_id := UUID_STRING();
    INSERT INTO SAARTHI.GOVERNANCE.PATIENT_BINDING
        (binding_id, session_id, snowflake_user, patient_id, care_team_id, consent_id, bound_at)
    VALUES
        (:v_binding_id, CURRENT_SESSION(), CURRENT_USER(), :p_patient_id, :v_care_team_id, :v_consent_id, CURRENT_TIMESTAMP());

    RETURN OBJECT_CONSTRUCT('binding_id', v_binding_id);
END;
$$;
