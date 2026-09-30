-- =============================================================================
-- STEP 14 - Tool 2: get_readiness
-- =============================================================================
-- Contract 2. COPILOT-SPEC.md §0: NO patient selector. encounter_ref is
-- optional and MUST belong to the bound patient - an encounter id from
-- another patient fails on binding_mismatch, not authorisation (A1 wearing
-- a different parameter name). Preamble pasted verbatim from
-- procedures/tools/_preamble.sql - diffed at the Day-5 gate, never abstracted.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_readiness(
    ENCOUNTER_REF VARCHAR DEFAULT NULL,
    KNOWN_AS_OF   VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 2. Returns the 5 care-readiness gates for the BOUND patient. Takes no patient selector.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_known_as_of    TIMESTAMP_NTZ;
    v_known_as_of_s  VARCHAR;
    v_binding_id     VARCHAR;
    v_patient_id     VARCHAR;
    v_practitioner   VARCHAR;
    v_care_team_id   VARCHAR;
    v_consent_id     VARCHAR;
    v_encounter_id   VARCHAR;
    v_gates          VARIANT;
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

    -- Tool-specific: resolve the encounter. An encounter id from another
    -- patient fails on binding_mismatch, never on authorisation (A1).
    IF (:ENCOUNTER_REF IS NULL) THEN
        v_encounter_id := (SELECT encounter_id FROM SAARTHI.CORE.ENCOUNTER
                             WHERE patient_id = :v_patient_id AND scheduled_time >= CURRENT_TIMESTAMP()
                             ORDER BY scheduled_time ASC LIMIT 1);
        IF (v_encounter_id IS NULL) THEN
            v_encounter_id := (SELECT encounter_id FROM SAARTHI.CORE.ENCOUNTER
                                 WHERE patient_id = :v_patient_id
                                 ORDER BY scheduled_time DESC LIMIT 1);
        END IF;
    ELSE
        v_encounter_id := (SELECT encounter_id FROM SAARTHI.CORE.ENCOUNTER
                             WHERE encounter_id = :ENCOUNTER_REF AND patient_id = :v_patient_id);
        IF (v_encounter_id IS NULL) THEN
            RETURN OBJECT_CONSTRUCT('error', 'binding_mismatch', 'known_as_of', :v_known_as_of_s);
        END IF;
    END IF;

    v_gates := (CALL SAARTHI.OPERATIONAL.evaluate_gates(:v_patient_id, :v_encounter_id, :v_known_as_of_s));

    RETURN OBJECT_CONSTRUCT('gates', v_gates:gates, 'binding_id', v_binding_id,
                             'consent_id', v_consent_id, 'known_as_of', v_known_as_of_s);
END;
$$;
