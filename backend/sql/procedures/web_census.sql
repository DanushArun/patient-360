-- NOT DEPLOYED / NOT WIRED (code review CR1-17): nothing in frontend/ calls this procedure and setup.sql does not run it.
-- The authoritative implementation is GET_WEB_WORKSPACE / GET_WEB_PATIENT_DATA in web_reads.sql. Do not deploy this
-- file without first removing the duplicate view there; two unsynchronised authorization paths are a defect.
-- Census through the caller's primary Snowflake identity. No caller-selected
-- patient id is accepted; care team and current consent are resolved here.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_web_census(p_horizon_days NUMBER)
  RETURNS TABLE (
    encounter_id VARCHAR, patient_id VARCHAR, name VARCHAR, district VARCHAR,
    state VARCHAR, primary_language VARCHAR, regimen_display VARCHAR,
    cycle_number NUMBER, scheduled VARCHAR, gate VARCHAR, rule_id VARCHAR,
    rule_version NUMBER, outcome VARCHAR, severity VARCHAR, reason VARCHAR)
  LANGUAGE SQL
  COMMENT = 'Care-team and consent scoped web census for CURRENT_USER().'
  EXECUTE AS OWNER
AS
$$
DECLARE
  v_result RESULTSET;
BEGIN
  v_result := (
    WITH permitted_patients AS (
      SELECT DISTINCT ct.patient_id
        FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
        JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
        JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = pr.facility_id
       WHERE pr.snowflake_user = CURRENT_USER() AND pr.active = TRUE
         AND ct.active_from <= CURRENT_DATE()
         AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
         AND EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
                      WHERE c.patient_id = ct.patient_id AND c.status = 'active'
                        AND c.valid_from <= CURRENT_TIMESTAMP()
                        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                        AND c.purpose_code IN ('treatment', 'coordination')
                        AND (c.granted_to_facility_id = pr.facility_id OR c.granted_to_org_id = f.org_id))
    ), plan AS (
      SELECT patient_id, regimen_display FROM SAARTHI.CORE.TREATMENT_PLAN
       QUALIFY ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY version DESC, decided_at DESC NULLS LAST) = 1
    )
    SELECT e.encounter_id, p.patient_id, p.name, p.district, p.state, p.primary_language,
           plan.regimen_display, e.cycle_number,
           TO_VARCHAR(e.scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS'),
           rs.gate, rs.rule_id, rs.rule_version, rs.outcome, rs.severity, rs.reason
      FROM SAARTHI.CORE.ENCOUNTER e
      JOIN permitted_patients permitted ON permitted.patient_id = e.patient_id
      JOIN SAARTHI.CORE.PATIENT p ON p.patient_id = e.patient_id
      LEFT JOIN plan ON plan.patient_id = e.patient_id
      LEFT JOIN SAARTHI.OPERATIONAL.READINESS_STATE rs ON rs.encounter_id = e.encounter_id
     WHERE e.encounter_type = 'daycare'
       AND e.scheduled_time >= CURRENT_DATE()
       AND e.scheduled_time < DATEADD(day, :p_horizon_days, CURRENT_DATE())
     ORDER BY e.scheduled_time, p.name
  );
  RETURN TABLE(v_result);
END;
$$;
