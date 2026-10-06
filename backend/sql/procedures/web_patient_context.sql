-- NOT DEPLOYED / NOT WIRED (code review CR1-17): nothing in frontend/ calls this procedure and setup.sql does not run it.
-- The authoritative implementation is GET_WEB_WORKSPACE / GET_WEB_PATIENT_DATA in web_reads.sql. Do not deploy this
-- file without first removing the duplicate view there; two unsynchronised authorization paths are a defect.
-- Patient page context for the current Snowflake session only.
-- This procedure intentionally accepts no patient selector.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_web_patient_context()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Scoped web patient context from the active session binding.'
  EXECUTE AS OWNER
AS
$$
DECLARE
  v_patient_id VARCHAR;
  v_practitioner_id VARCHAR;
  v_facility_id VARCHAR;
  v_org_id VARCHAR;
  v_result VARIANT;
BEGIN
  v_patient_id := (SELECT patient_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                    WHERE session_id = CURRENT_SESSION()
                      AND snowflake_user = CURRENT_USER()
                      AND released_at IS NULL
                    ORDER BY bound_at DESC LIMIT 1);
  IF (v_patient_id IS NULL) THEN
    RETURN OBJECT_CONSTRUCT('error', 'no_patient_bound');
  END IF;

  v_practitioner_id := (SELECT practitioner_id FROM SAARTHI.GOVERNANCE.PRACTITIONER
                         WHERE snowflake_user = CURRENT_USER() AND active = TRUE);
  IF (v_practitioner_id IS NULL) THEN
    RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
  END IF;
  v_facility_id := (SELECT facility_id FROM SAARTHI.GOVERNANCE.PRACTITIONER
                     WHERE practitioner_id = :v_practitioner_id);
  v_org_id := (SELECT org_id FROM SAARTHI.GOVERNANCE.FACILITY WHERE facility_id = :v_facility_id);

  IF (NOT EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
                   WHERE ct.practitioner_id = :v_practitioner_id
                     AND ct.patient_id = :v_patient_id
                     AND ct.active_from <= CURRENT_DATE()
                     AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE()))) THEN
    RETURN OBJECT_CONSTRUCT('error', 'no_patient_access');
  END IF;
  IF (NOT EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
                   WHERE c.patient_id = :v_patient_id AND c.status = 'active'
                     AND c.valid_from <= CURRENT_TIMESTAMP()
                     AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                     AND c.purpose_code IN ('treatment', 'coordination')
                     AND (c.granted_to_facility_id = :v_facility_id OR c.granted_to_org_id = :v_org_id))) THEN
    RETURN OBJECT_CONSTRUCT('error', 'consent_not_valid');
  END IF;

  v_result := (WITH next_visit AS (
    SELECT cycle_number,
           TO_VARCHAR(scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled_at
      FROM SAARTHI.CORE.ENCOUNTER
     WHERE patient_id = :v_patient_id AND encounter_type = 'daycare'
       AND scheduled_time >= CURRENT_DATE()
     QUALIFY ROW_NUMBER() OVER (ORDER BY scheduled_time) = 1
  ), latest_plan AS (
    SELECT regimen_display
      FROM SAARTHI.CORE.TREATMENT_PLAN
     WHERE patient_id = :v_patient_id
     QUALIFY ROW_NUMBER() OVER (ORDER BY version DESC, decided_at DESC NULLS LAST) = 1
  ), latest_diagnosis AS (
    -- The condition under treatment: the most recent diagnosis event on the record.
    SELECT display, code, code_system
      FROM SAARTHI.CORE.CLINICAL_EVENT
     WHERE patient_id = :v_patient_id AND event_type = 'diagnosis' AND display IS NOT NULL
     QUALIFY ROW_NUMBER() OVER (ORDER BY event_time DESC, event_id DESC) = 1
  )
  SELECT OBJECT_CONSTRUCT_KEEP_NULL(
           'NAME', p.name,
           'PRIMARY_LANGUAGE', p.primary_language,
           'SCHEDULED_AT', nv.scheduled_at,
           'CYCLE_NUMBER', nv.cycle_number,
           'REGIMEN_DISPLAY', lp.regimen_display,
           'DIAGNOSIS', ld.display,
           'DIAGNOSIS_CODE', ld.code,
           'DIAGNOSIS_CODE_SYSTEM', ld.code_system,
           'CONSENT_ID', (SELECT c.consent_id FROM SAARTHI.GOVERNANCE.CONSENT c
                           WHERE c.patient_id = :v_patient_id AND c.status = 'active'
                             AND c.valid_from <= CURRENT_TIMESTAMP()
                             AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                             AND c.purpose_code IN ('treatment', 'coordination')
                             AND (c.granted_to_facility_id = :v_facility_id OR c.granted_to_org_id = :v_org_id)
                           ORDER BY c.valid_from DESC LIMIT 1),
           'PRACTITIONER_NAME', pr.name)
    FROM SAARTHI.CORE.PATIENT p
    JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = :v_practitioner_id
    LEFT JOIN next_visit nv ON TRUE
    LEFT JOIN latest_plan lp ON TRUE
    LEFT JOIN latest_diagnosis ld ON TRUE
   WHERE p.patient_id = :v_patient_id);
  RETURN v_result;
END;
$$;
