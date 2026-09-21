-- =============================================================================
-- STEP 14 - Tool 7: get_changes
-- =============================================================================
-- Contract 2. D10: "what changed since 09:00?" - a real demo question with
-- no tool path before this. Diffs two known_as_of states for the bound
-- patient: new events since from_ts, and values that differ between the two
-- cutoffs for the same concept.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_changes(FROM_TS VARCHAR, TO_TS VARCHAR)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 7. Diffs two known_as_of states for the BOUND patient. Takes no patient selector.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_from         TIMESTAMP_NTZ;
    v_to           TIMESTAMP_NTZ;
    v_binding_id   VARCHAR;
    v_patient_id   VARCHAR;
    v_practitioner VARCHAR;
    v_care_team_id VARCHAR;
    v_changes      ARRAY;
BEGIN
    v_from := TRY_TO_TIMESTAMP_NTZ(:FROM_TS);
    v_to := COALESCE(TRY_TO_TIMESTAMP_NTZ(:TO_TS), CURRENT_TIMESTAMP());
    IF (v_from IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'invalid_argument');
    END IF;

    v_binding_id := (SELECT binding_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                       WHERE session_id = CURRENT_SESSION() AND released_at IS NULL
                       ORDER BY bound_at DESC LIMIT 1);
    IF (v_binding_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_bound');
    END IF;
    v_patient_id := (SELECT patient_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING WHERE binding_id = :v_binding_id);

    v_practitioner := (SELECT practitioner_id FROM SAARTHI.GOVERNANCE.PRACTITIONER
                        WHERE snowflake_user = CURRENT_USER() AND active = TRUE);
    IF (v_practitioner IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;
    v_care_team_id := (SELECT care_team_id FROM SAARTHI.GOVERNANCE.CARE_TEAM
                        WHERE practitioner_id = :v_practitioner AND patient_id = :v_patient_id
                          AND active_from <= CURRENT_DATE() AND (active_to IS NULL OR active_to >= CURRENT_DATE())
                        ORDER BY active_from DESC LIMIT 1);
    IF (v_care_team_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;

    -- Events visible at TO_TS but not at FROM_TS - genuinely new knowledge,
    -- not a value that merely changed.
    v_changes := (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(
                 'concept', concept_name, 'value', value_num, 'event_id', event_id,
                 'event_time', event_time, 'change_type', 'new_since_from_ts'))
               WITHIN GROUP (ORDER BY event_time)
          FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS
         WHERE patient_id = :v_patient_id
           AND ingested_at <= :v_to
           AND ingested_at > :v_from);

    RETURN OBJECT_CONSTRUCT('changes', COALESCE(v_changes, ARRAY_CONSTRUCT()),
                             'from_ts', TO_VARCHAR(v_from, 'YYYY-MM-DD"T"HH24:MI:SS'),
                             'to_ts', TO_VARCHAR(v_to, 'YYYY-MM-DD"T"HH24:MI:SS'));
END;
$$;
