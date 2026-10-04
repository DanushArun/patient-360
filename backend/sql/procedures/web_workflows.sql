-- Human task lifecycle only. Uses existing REVIEW_ISSUE.version for optimistic locking.
-- REVIEW_TASK keeps append-only action receipts (web-event:<target>:<request>),
-- while the original task row is the current projection. Receipts are excluded from queues.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.UPDATE_WEB_REVIEW_TASK(
TASK_REF VARCHAR, ACTION VARCHAR, NEW_OWNER VARCHAR, NOTE VARCHAR, EXPECTED_VERSION INTEGER, REQUEST_KEY VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS $$
DECLARE KNOWN_AS_OF VARCHAR DEFAULT NULL;
v_known_as_of TIMESTAMP_NTZ; v_known_as_of_s VARCHAR; v_binding_id VARCHAR;
v_patient_id VARCHAR; v_practitioner VARCHAR; v_care_team_id VARCHAR; v_consent_id VARCHAR;

v_issue VARCHAR; v_owner VARCHAR; v_state VARCHAR; v_next_state VARCHAR; v_receipt VARCHAR; v_changed INTEGER;
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
                          AND role_type IN ('treating', 'coordinator')
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
IF (NOT EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM WHERE care_team_id=:v_care_team_id AND role_type IN ('treating','coordinator'))) THEN RETURN OBJECT_CONSTRUCT('error','no_patient_access'); END IF;
IF (ACTION IS NULL OR ACTION NOT IN ('acknowledge','reassign','resolve') OR NOTE IS NULL OR LENGTH(TRIM(NOTE))<3 OR LENGTH(NOTE)>2000 OR EXPECTED_VERSION IS NULL OR EXPECTED_VERSION<0 OR REQUEST_KEY IS NULL OR LENGTH(REQUEST_KEY)>80 OR LENGTH(REQUEST_KEY)<8) THEN RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
SELECT rt.issue_id, rt.owner_practitioner_id, rt.state INTO :v_issue,:v_owner,:v_state
FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt WHERE rt.task_id=:TASK_REF AND rt.idempotency_key NOT LIKE 'web-event:%'
AND (EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_ISSUE ri WHERE ri.issue_id=rt.issue_id AND ri.patient_id=:v_patient_id)
 OR EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.READINESS_STATE rs WHERE rs.patient_id=:v_patient_id AND rs.patient_id||':'||rs.rule_id=rt.issue_id));
IF (v_issue IS NULL) THEN RETURN OBJECT_CONSTRUCT('error','binding_mismatch'); END IF;
v_receipt := 'web-event:'||TASK_REF||':'||REQUEST_KEY;
IF (EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_TASK WHERE idempotency_key=:v_receipt AND actor_practitioner_id=:v_practitioner AND decision=:ACTION AND reason=:NOTE AND (:ACTION!='reassign' OR owner_practitioner_id=:NEW_OWNER))) THEN RETURN OBJECT_CONSTRUCT('task_id',TASK_REF,'idempotent_replay',TRUE); END IF;
IF (EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_TASK WHERE idempotency_key=:v_receipt)) THEN RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
IF (v_state IS NULL OR v_state IN ('resolved','closed','cancelled') OR (ACTION='acknowledge' AND v_state!='open')) THEN RETURN OBJECT_CONSTRUCT('error','invalid_transition'); END IF;
IF (ACTION='reassign') THEN
 IF (NEW_OWNER IS NULL OR NOT EXISTS (
 SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
JOIN SAARTHI.GOVERNANCE.PRACTITIONER p ON p.practitioner_id=ct.practitioner_id
LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id=p.facility_id
WHERE ct.patient_id=:v_patient_id AND p.active=TRUE AND ct.role_type IN ('treating','coordinator')
AND ct.active_from<=CURRENT_DATE() AND (ct.active_to IS NULL OR ct.active_to>=CURRENT_DATE())
AND EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c WHERE c.patient_id=ct.patient_id
AND c.status='active' AND c.valid_from<=CURRENT_TIMESTAMP() AND (c.valid_until IS NULL OR c.valid_until>=CURRENT_TIMESTAMP())
AND c.purpose_code IN ('treatment','coordination') AND (c.granted_to_facility_id=p.facility_id OR c.granted_to_org_id=f.org_id))
AND p.practitioner_id=:NEW_OWNER
 )) THEN RETURN OBJECT_CONSTRUCT('error','owner_not_authorized'); END IF;
 v_owner := NEW_OWNER;
END IF;
v_next_state := CASE WHEN ACTION='acknowledge' THEN 'acknowledged' WHEN ACTION='resolve' THEN 'resolved' ELSE v_state END;
BEGIN TRANSACTION;
-- Upgrade the existing patient:rule identifier into its specified issue row; no new patient or rule.
MERGE INTO SAARTHI.OPERATIONAL.REVIEW_ISSUE t USING (
 SELECT :v_issue AS issue_id,rs.* FROM SAARTHI.OPERATIONAL.READINESS_STATE rs
 WHERE rs.patient_id=:v_patient_id AND rs.patient_id||':'||rs.rule_id=:v_issue
 QUALIFY ROW_NUMBER() OVER (ORDER BY rs.known_as_of DESC,rs.encounter_id)=1
) s ON t.issue_id=s.issue_id
WHEN NOT MATCHED THEN INSERT(issue_id,rule_id,rule_version,patient_id,encounter_id,gate,state,outcome,reason,evidence_ids,severity,version)
VALUES(s.issue_id,s.rule_id,s.rule_version,s.patient_id,s.encounter_id,s.gate,'open',s.outcome,s.reason,s.evidence_ids,s.severity,0);
UPDATE SAARTHI.OPERATIONAL.REVIEW_ISSUE SET version=version+1 WHERE issue_id=:v_issue AND patient_id=:v_patient_id AND version=:EXPECTED_VERSION;
v_changed := SQLROWCOUNT;
IF (v_changed!=1) THEN ROLLBACK; RETURN OBJECT_CONSTRUCT('error','stale_task'); END IF;
UPDATE SAARTHI.OPERATIONAL.REVIEW_TASK SET owner_practitioner_id=:v_owner,state=:v_next_state
WHERE task_id=:TASK_REF AND state=:v_state;
v_changed := SQLROWCOUNT;
IF (v_changed!=1) THEN ROLLBACK; RETURN OBJECT_CONSTRUCT('error','stale_task'); END IF;
INSERT INTO SAARTHI.OPERATIONAL.REVIEW_TASK(task_id,issue_id,owner_practitioner_id,state,decision,reason,actor_practitioner_id,idempotency_key)
SELECT UUID_STRING(),:v_issue,:v_owner,:v_next_state,:ACTION,:NOTE,:v_practitioner,:v_receipt;
-- Keep the issue consistent with its tasks: when the last open work item on an issue is
-- resolved the issue closes; it never stays 'open' behind an all-resolved task list.
UPDATE SAARTHI.OPERATIONAL.REVIEW_ISSUE SET state='closed'
WHERE issue_id=:v_issue AND patient_id=:v_patient_id AND :ACTION='resolve'
AND NOT EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt2 WHERE rt2.issue_id=:v_issue
  AND rt2.idempotency_key NOT LIKE 'web-event:%' AND rt2.state IN ('open','acknowledged'));
COMMIT;
RETURN OBJECT_CONSTRUCT('task_id',TASK_REF,'state',v_next_state,'version',EXPECTED_VERSION+1,'idempotent_replay',FALSE);
EXCEPTION WHEN OTHER THEN
 ROLLBACK;
 RAISE;
END;
$$;

-- On-demand, one bound patient/visit; no AI and no scheduled refresh.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.REFRESH_BOUND_READINESS()
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS $$
DECLARE KNOWN_AS_OF VARCHAR DEFAULT NULL;
v_known_as_of TIMESTAMP_NTZ; v_known_as_of_s VARCHAR; v_binding_id VARCHAR;
v_patient_id VARCHAR; v_practitioner VARCHAR; v_care_team_id VARCHAR; v_consent_id VARCHAR;

v_encounter_id VARCHAR; v_gates_response VARIANT;
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
                          AND role_type IN ('treating', 'coordinator')
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
v_encounter_id := (SELECT encounter_id FROM SAARTHI.CORE.ENCOUNTER WHERE patient_id=:v_patient_id AND encounter_type='daycare'
ORDER BY IFF(scheduled_time>=CURRENT_TIMESTAMP(),0,1),
IFF(scheduled_time>=CURRENT_TIMESTAMP(),scheduled_time,NULL) ASC NULLS LAST,
IFF(scheduled_time<CURRENT_TIMESTAMP(),scheduled_time,NULL) DESC NULLS LAST,encounter_id LIMIT 1);
IF (v_encounter_id IS NULL) THEN RETURN OBJECT_CONSTRUCT('error','no_encounter'); END IF;
v_gates_response := (CALL SAARTHI.OPERATIONAL.GET_READINESS(:v_encounter_id,:v_known_as_of_s));
IF (v_gates_response:error IS NOT NULL OR NOT IS_ARRAY(v_gates_response:gates)) THEN RETURN OBJECT_CONSTRUCT('error','readiness_unavailable'); END IF;
        MERGE INTO SAARTHI.OPERATIONAL.READINESS_STATE t
        USING (
            SELECT :v_patient_id AS patient_id,
                   :v_encounter_id AS encounter_id,
                   g.value:gate::VARCHAR         AS gate,
                   g.value:rule_id::VARCHAR      AS rule_id,
                   g.value:rule_version::INTEGER AS rule_version,
                   g.value:outcome::VARCHAR      AS outcome,
                   g.value:severity::VARCHAR     AS severity,
                   g.value:reason::VARCHAR       AS reason,
                   g.value:evidence_ids          AS evidence_ids,
                   TRY_TO_TIMESTAMP_NTZ(g.value:known_as_of::VARCHAR) AS known_as_of
              FROM TABLE(FLATTEN(input => :v_gates_response:gates)) g
        ) s
        ON t.patient_id = s.patient_id
           AND t.encounter_id = s.encounter_id
           AND t.rule_id = s.rule_id
           AND t.gate = s.gate
        WHEN MATCHED THEN UPDATE SET
            t.rule_version = s.rule_version,
            t.outcome = s.outcome,
            t.severity = s.severity,
            t.reason = s.reason,
            t.evidence_ids = s.evidence_ids,
            t.known_as_of = s.known_as_of,
            t.computed_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            patient_id, encounter_id, gate, rule_id, rule_version,
            outcome, severity, reason, evidence_ids, known_as_of, computed_at
        ) VALUES (
            s.patient_id, s.encounter_id, s.gate, s.rule_id, s.rule_version,
            s.outcome, s.severity, s.reason, s.evidence_ids, s.known_as_of, CURRENT_TIMESTAMP()
        );
RETURN v_gates_response;
END;
$$;
