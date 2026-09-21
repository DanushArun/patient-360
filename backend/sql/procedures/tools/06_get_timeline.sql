-- =============================================================================
-- STEP 14 - Tool 6: get_timeline
-- =============================================================================
-- Contract 2. D10: closes a real hole - "when did the FISH result arrive?"
-- had no tool path before this. All three R2 clocks per event, plus facility.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_timeline(KNOWN_AS_OF VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 6. Chronology for the BOUND patient, all 3 R2 clocks. Takes no patient selector.'
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
    v_timeline       ARRAY;
BEGIN
-- >>> SAARTHI PREAMBLE v1 BEGIN
    v_known_as_of := COALESCE(TRY_TO_TIMESTAMP_NTZ(:KNOWN_AS_OF), CURRENT_TIMESTAMP());
    v_known_as_of_s := TO_VARCHAR(:v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS');

    v_binding_id := (SELECT binding_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                       WHERE session_id = CURRENT_SESSION() AND released_at IS NULL
                       ORDER BY bound_at DESC LIMIT 1);
    IF (v_binding_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_bound', 'known_as_of', :v_known_as_of_s);
    END IF;
    v_patient_id := (SELECT patient_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING WHERE binding_id = :v_binding_id);

    v_practitioner := (SELECT practitioner_id FROM SAARTHI.GOVERNANCE.PRACTITIONER
                        WHERE snowflake_user = CURRENT_USER() AND active = TRUE);
    IF (v_practitioner IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access', 'known_as_of', :v_known_as_of_s);
    END IF;

    v_care_team_id := (SELECT care_team_id FROM SAARTHI.GOVERNANCE.CARE_TEAM
                        WHERE practitioner_id = :v_practitioner AND patient_id = :v_patient_id
                          AND active_from <= CURRENT_DATE() AND (active_to IS NULL OR active_to >= CURRENT_DATE())
                        ORDER BY active_from DESC LIMIT 1);
    IF (v_care_team_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access', 'known_as_of', :v_known_as_of_s);
    END IF;

    v_consent_id := (SELECT c.consent_id FROM SAARTHI.GOVERNANCE.CONSENT c
                       JOIN SAARTHI.GOVERNANCE.PRACTITIONER p ON p.practitioner_id = :v_practitioner
                       LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = p.facility_id
                      WHERE c.patient_id = :v_patient_id AND c.status = 'active'
                        AND c.valid_from <= CURRENT_TIMESTAMP() AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                        AND c.purpose_code IN ('treatment', 'coordination')
                        AND (c.granted_to_facility_id = p.facility_id OR c.granted_to_org_id = f.org_id)
                      ORDER BY c.valid_from DESC LIMIT 1);
    IF (v_consent_id IS NULL) THEN
        UPDATE SAARTHI.GOVERNANCE.PATIENT_BINDING SET released_at = CURRENT_TIMESTAMP()
         WHERE binding_id = :v_binding_id AND released_at IS NULL;
        RETURN OBJECT_CONSTRUCT('error', 'access_withdrawn', 'known_as_of', :v_known_as_of_s);
    END IF;
-- <<< SAARTHI PREAMBLE v1 END

    v_timeline := (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(
                 'concept', concept_name, 'value', value_num, 'is_derived', is_derived,
                 'event_time', event_time, 'source_recorded_at', source_recorded_at,
                 'ingested_at', ingested_at, 'event_id', event_id))
               WITHIN GROUP (ORDER BY event_time)
          FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS
         WHERE patient_id = :v_patient_id AND ingested_at <= :v_known_as_of);

    RETURN OBJECT_CONSTRUCT('timeline', COALESCE(v_timeline, ARRAY_CONSTRUCT()),
                             'binding_id', v_binding_id, 'known_as_of', v_known_as_of_s);
END;
$$;
