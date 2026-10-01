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
    KNOWN_AS_OF VARCHAR DEFAULT NULL;
    v_known_as_of TIMESTAMP_NTZ;
    v_known_as_of_s VARCHAR;
    v_care_team_id VARCHAR;
    v_consent_id VARCHAR;
    v_binding_id   VARCHAR;
    v_patient_id   VARCHAR;
    v_practitioner VARCHAR;
    v_role_type    VARCHAR;
    v_task_id      VARCHAR;
    v_existing     VARCHAR;
    v_issue_in_scope BOOLEAN;
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
    IF (:ACTION IS NULL OR :ACTION NOT IN ('escalate', 'close', 'reassign', 'request_document')
        OR :ISSUE_ID IS NULL OR :IDEMPOTENCY_KEY IS NULL OR TRIM(:IDEMPOTENCY_KEY) = '') THEN
        RETURN OBJECT_CONSTRUCT('error', 'invalid_argument');
    END IF;

    -- Both persisted issue IDs and the existing patient:rule convention are
    -- resolved against SQL rows for the bound patient before replay or write.
    v_issue_in_scope := (
        SELECT EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_ISSUE
                        WHERE issue_id = :ISSUE_ID AND patient_id = :v_patient_id)
            OR EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.READINESS_STATE
                        WHERE patient_id = :v_patient_id
                          AND patient_id || ':' || rule_id = :ISSUE_ID)
    );
    IF (NOT v_issue_in_scope) THEN
        RETURN OBJECT_CONSTRUCT('error', 'binding_mismatch', 'known_as_of', :v_known_as_of_s);
    END IF;

    -- Idempotency: a retried call with the same key must never double-fire.
    v_existing := (SELECT task_id FROM SAARTHI.OPERATIONAL.REVIEW_TASK WHERE idempotency_key = :IDEMPOTENCY_KEY);
    IF (v_existing IS NOT NULL) THEN
        IF (NOT EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_TASK
                         WHERE task_id = :v_existing
                           AND issue_id = :ISSUE_ID AND actor_practitioner_id = :v_practitioner)) THEN
            RETURN OBJECT_CONSTRUCT('error', 'invalid_argument', 'known_as_of', :v_known_as_of_s);
        END IF;
        RETURN OBJECT_CONSTRUCT('task_id', v_existing, 'idempotent_replay', TRUE);
    END IF;

    v_task_id := UUID_STRING();
    -- These transitions require a task identity, expected issue version and
    -- (for reassignment) an authorized new owner. Never file a misleading open task.
    IF (:ACTION IN ('close', 'reassign')) THEN
        RETURN OBJECT_CONSTRUCT('error', 'task_transition_requires_review');
    END IF;
    INSERT INTO SAARTHI.OPERATIONAL.REVIEW_TASK
        (task_id, issue_id, owner_practitioner_id, state, decision, reason, actor_practitioner_id, idempotency_key)
    VALUES
        (:v_task_id, :ISSUE_ID, :v_practitioner, 'open', :ACTION, :REASON, :v_practitioner, :IDEMPOTENCY_KEY);

    RETURN OBJECT_CONSTRUCT('task_id', v_task_id, 'idempotent_replay', FALSE);
END;
$$;
