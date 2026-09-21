-- =============================================================================
-- STEP 14 - Tool 8: create_review_task (the only write tool)
-- =============================================================================
-- Contract 2. Restricted to treating|coordinator - patient_navigator cannot
-- create tasks. action is a closed enum; "approve treatment" does not exist
-- as a value (SPEC.md 605's literal test case). Idempotent via
-- idempotency_key - a retry must never double-fire.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.create_review_task(
    ISSUE_ID VARCHAR, ACTION VARCHAR, REASON VARCHAR, IDEMPOTENCY_KEY VARCHAR)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 8. The only write tool. Role-restricted, idempotent.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_binding_id   VARCHAR;
    v_patient_id   VARCHAR;
    v_practitioner VARCHAR;
    v_role_type    VARCHAR;
    v_task_id      VARCHAR;
    v_existing     VARCHAR;
BEGIN
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

    v_role_type := (SELECT role_type FROM SAARTHI.GOVERNANCE.CARE_TEAM
                      WHERE practitioner_id = :v_practitioner AND patient_id = :v_patient_id
                        AND active_from <= CURRENT_DATE() AND (active_to IS NULL OR active_to >= CURRENT_DATE())
                      ORDER BY active_from DESC LIMIT 1);
    IF (v_role_type IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;
    IF (v_role_type NOT IN ('treating', 'coordinator')) THEN
        -- patient_navigator, consulting: explicitly denied. Not a missing
        -- feature - a role restriction on the only write tool.
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
    END IF;

    -- 'approve treatment' and any other clinical-decision action do not
    -- exist as values. This is not free-text.
    IF (:ACTION NOT IN ('escalate', 'close', 'reassign', 'request_document')) THEN
        RETURN OBJECT_CONSTRUCT('error', 'invalid_argument');
    END IF;

    -- Idempotency: a retried call with the same key must never double-fire.
    v_existing := (SELECT task_id FROM SAARTHI.OPERATIONAL.REVIEW_TASK WHERE idempotency_key = :IDEMPOTENCY_KEY);
    IF (v_existing IS NOT NULL) THEN
        RETURN OBJECT_CONSTRUCT('task_id', v_existing, 'idempotent_replay', TRUE);
    END IF;

    v_task_id := UUID_STRING();
    INSERT INTO SAARTHI.OPERATIONAL.REVIEW_TASK
        (task_id, issue_id, owner_practitioner_id, state, decision, reason, actor_practitioner_id, idempotency_key)
    VALUES
        (:v_task_id, :ISSUE_ID, :v_practitioner, 'open', :ACTION, :REASON, :v_practitioner, :IDEMPOTENCY_KEY);

    RETURN OBJECT_CONSTRUCT('task_id', v_task_id, 'idempotent_replay', FALSE);
END;
$$;
