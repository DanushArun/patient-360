-- NOT DEPLOYED / NOT WIRED (code review CR1-17): nothing in frontend/ calls this procedure and setup.sql does not run it.
-- The authoritative implementation is GET_WEB_WORKSPACE / GET_WEB_PATIENT_DATA in web_reads.sql. Do not deploy this
-- file without first removing the duplicate view there; two unsynchronised authorization paths are a defect.
-- Navigator scheme coverage for the patient already bound to this session.
-- No patient selector is accepted; access and consent are rechecked at query time.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_web_scheme_eligibility()
  RETURNS TABLE (scheme_id VARCHAR, scheme_name VARCHAR, scheme_type VARCHAR,
                 annual_limit FLOAT, eligibility_status VARCHAR, covered_packages ARRAY)
  LANGUAGE SQL
  COMMENT = 'Bound-patient scheme coverage after live care-team and consent checks.'
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
                         WHERE snowflake_user = CURRENT_USER() AND active = TRUE);
  IF (v_patient_id IS NULL OR v_practitioner_id IS NULL) THEN
    v_result := (SELECT NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR,
                        NULL::FLOAT, NULL::VARCHAR, NULL::ARRAY WHERE FALSE);
    RETURN TABLE(v_result);
  END IF;
  v_result := (
    SELECT scheme_id, scheme_name, scheme_type, annual_limit,
           eligibility_status, covered_packages
      FROM SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY
     WHERE patient_id = :v_patient_id
       AND EXISTS (
         SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
          WHERE ct.patient_id = :v_patient_id AND ct.practitioner_id = :v_practitioner_id
            AND ct.active_from <= CURRENT_DATE()
            AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
       )
       AND EXISTS (
         SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
         JOIN SAARTHI.GOVERNANCE.PRACTITIONER p ON p.practitioner_id = :v_practitioner_id
         LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = p.facility_id
          WHERE c.patient_id = :v_patient_id AND c.status = 'active'
            AND c.valid_from <= CURRENT_TIMESTAMP()
            AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
            AND c.purpose_code IN ('treatment', 'coordination')
            AND (c.granted_to_facility_id = p.facility_id OR c.granted_to_org_id = f.org_id)
       )
     ORDER BY scheme_name
  );
  RETURN TABLE(v_result);
END;
$$;
