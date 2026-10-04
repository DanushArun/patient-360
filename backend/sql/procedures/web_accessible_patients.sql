-- NOT DEPLOYED / NOT WIRED (code review CR1-17): nothing in web/ calls this procedure and setup.sql does not run it.
-- The authoritative implementation is GET_WEB_WORKSPACE / GET_WEB_PATIENT_DATA in web_reads.sql. Do not deploy this
-- file without first removing the duplicate view there; two unsynchronised authorization paths are a defect.
-- Accessible-patient picker inventory. No patient selector is accepted.
-- Scope and active consent are resolved under the procedure owner's rights.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_web_accessible_patients()
  RETURNS TABLE (patient_id VARCHAR, name VARCHAR, practitioner_name VARCHAR)
  LANGUAGE SQL
  COMMENT = 'Current-user care-team and consent scoped patient picker.'
  EXECUTE AS OWNER
AS
$$
DECLARE
  v_result RESULTSET;
BEGIN
  v_result := (
    SELECT DISTINCT p.patient_id, p.name, pr.name AS practitioner_name
      FROM SAARTHI.GOVERNANCE.PRACTITIONER pr
      JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = pr.facility_id
      JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct ON ct.practitioner_id = pr.practitioner_id
      JOIN SAARTHI.CORE.PATIENT p ON p.patient_id = ct.patient_id
     WHERE pr.snowflake_user = CURRENT_USER()
       AND pr.active = TRUE
       AND ct.active_from <= CURRENT_DATE()
       AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
       AND EXISTS (
         SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
          WHERE c.patient_id = p.patient_id
            AND c.status = 'active'
            AND c.valid_from <= CURRENT_TIMESTAMP()
            AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
            AND c.purpose_code IN ('treatment', 'coordination')
            AND (c.granted_to_facility_id = pr.facility_id OR c.granted_to_org_id = f.org_id)
       )
     ORDER BY p.name
  );
  RETURN TABLE(v_result);
END;
$$;
