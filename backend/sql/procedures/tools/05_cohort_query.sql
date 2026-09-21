-- =============================================================================
-- STEP 14 - Tool 5: cohort_query
-- =============================================================================
-- Contract 2. Cortex Analyst over the semantic view. Deliberately UNAVAILABLE
-- while a patient is bound - COPILOT-SPEC.md §0: mixing a bound-patient
-- conversation with cross-patient results is how a coordinator misreads one
-- patient's data as another's. No single subject; operates over the
-- permitted set via the semantic view only.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.cohort_query(QUESTION VARCHAR)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 5. Cortex Analyst over SAARTHI_SEMANTIC_VIEW. Refuses while a patient is bound.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_binding_id   VARCHAR;
    v_practitioner VARCHAR;
BEGIN
    v_binding_id := (SELECT binding_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                       WHERE session_id = CURRENT_SESSION() AND released_at IS NULL
                       ORDER BY bound_at DESC LIMIT 1);
    IF (v_binding_id IS NOT NULL) THEN
        -- The one inversion in this tool set: every other tool requires a
        -- binding, this one refuses while one exists.
        RETURN OBJECT_CONSTRUCT('error', 'binding_mismatch',
            'message', 'Release the bound patient before asking a cohort question.');
    END IF;

    v_practitioner := (SELECT practitioner_id FROM SAARTHI.GOVERNANCE.PRACTITIONER
                        WHERE snowflake_user = CURRENT_USER() AND active = TRUE);
    IF (v_practitioner IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;

    -- This build answers via the semantic view's own aggregates directly
    -- rather than a full Cortex Analyst NL-to-SQL round trip (that needs
    -- CREATE AGENT / Analyst wiring, not yet built) - a fixed, safe query
    -- shape over the same governed semantic view, not free-text SQL.
    LET v_result VARIANT := (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT('gap_type', gap_type, 'encounter_count', encounter_count,
                                           'complication_count', complication_count))
        FROM SEMANTIC_VIEW(
            SAARTHI.OPERATIONAL.SAARTHI_SEMANTIC_VIEW
            DIMENSIONS encounter.gap_type
            METRICS encounter.encounter_count, encounter.complication_count
        )
    );

    RETURN OBJECT_CONSTRUCT('question', QUESTION, 'note',
        'Answered via a fixed semantic-view aggregate, not full NL-to-SQL (Cortex Analyst agent wiring not yet built)',
        'sample_result', v_result);
END;
$$;
