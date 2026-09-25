-- Review history for the patient already bound to this Snowflake session.
-- Only a rule selector is accepted; patient identity comes from the binding.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_web_review_tasks(p_rule_id VARCHAR)
  RETURNS TABLE (task_id VARCHAR, issue_id VARCHAR, owner VARCHAR, state VARCHAR,
                 decision VARCHAR, reason VARCHAR, created_at VARCHAR)
  LANGUAGE SQL
  COMMENT = 'Scoped web review history for the current session binding.'
  EXECUTE AS OWNER
AS
$$
DECLARE
  v_patient_id VARCHAR;
  v_practitioner_id VARCHAR;
  v_result RESULTSET;
BEGIN
  v_patient_id := (SELECT patient_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                    WHERE session_id = CURRENT_SESSION() AND snowflake_user = CURRENT_USER()
                      AND released_at IS NULL ORDER BY bound_at DESC LIMIT 1);
  v_practitioner_id := (SELECT practitioner_id FROM SAARTHI.GOVERNANCE.PRACTITIONER
                         WHERE UPPER(snowflake_user) = UPPER(CURRENT_USER()) AND active = TRUE);
  IF (v_patient_id IS NULL OR v_practitioner_id IS NULL) THEN
    v_result := (SELECT NULL::VARCHAR AS task_id, NULL::VARCHAR AS issue_id,
                        NULL::VARCHAR AS owner, NULL::VARCHAR AS state,
                        NULL::VARCHAR AS decision, NULL::VARCHAR AS reason,
                        NULL::VARCHAR AS created_at WHERE FALSE);
    RETURN TABLE(v_result);
  END IF;
  v_result := (
    SELECT rt.task_id, rt.issue_id, COALESCE(pr.name, rt.owner_practitioner_id),
           rt.state, rt.decision, rt.reason,
           TO_VARCHAR(rt.created_at, 'YYYY-MM-DD"T"HH24:MI:SS')
      FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
      LEFT JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = rt.owner_practitioner_id
     WHERE rt.issue_id = :v_patient_id || ':' || :p_rule_id
       AND EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
                    WHERE ct.patient_id = :v_patient_id AND ct.practitioner_id = :v_practitioner_id
                      AND ct.role_type IN ('treating', 'coordinator')
                      AND ct.active_from <= CURRENT_DATE()
                      AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE()))
       AND EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
                    JOIN SAARTHI.GOVERNANCE.PRACTITIONER p ON p.practitioner_id = :v_practitioner_id
                    LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = p.facility_id
                   WHERE c.patient_id = :v_patient_id AND c.status = 'active'
                     AND c.valid_from <= CURRENT_TIMESTAMP()
                     AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                     AND c.purpose_code IN ('treatment', 'coordination')
                     AND (c.granted_to_facility_id = p.facility_id OR c.granted_to_org_id = f.org_id))
     ORDER BY rt.created_at DESC
  );
  RETURN TABLE(v_result);
END;
$$;
