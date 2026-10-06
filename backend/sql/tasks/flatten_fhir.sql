-- =============================================================================
-- STEP 16e - TASK flatten_fhir
-- =============================================================================
-- SPEC.md §14 diagram: RAW_FHIR_BUNDLE -> LATERAL FLATTEN -> CLINICAL_EVENT.
-- Reads unprocessed FHIR bundles and emits one CLINICAL_EVENT row per
-- Observation/Condition/MedicationAdministration resource inside.
--
-- Idempotent: dedups on (patient_id, event_id) via MERGE. Reprocessing the
-- same bundle produces zero new rows.
--
-- Current status: RAW_FHIR_BUNDLE has 0 rows because per-patient FHIR
-- generation is on the multi-patient roadmap.
-- The task is created so a fresh deploy is complete, and it is a no-op
-- until bundles land. Structure verified by shape not by live output.

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.flatten_fhir_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Task body for flatten_fhir. Deterministic LATERAL FLATTEN over RAW_FHIR_BUNDLE.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_pending INTEGER DEFAULT 0;
    v_events_written INTEGER DEFAULT 0;
    v_bundle_id VARCHAR;
    v_payload VARIANT;
    v_source_id VARCHAR;
    v_patient_id VARCHAR;
    c_bundles CURSOR FOR
        SELECT bundle_id, payload, source_id
          FROM SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE
         WHERE processed_at IS NULL;
BEGIN
    v_pending := (SELECT COUNT(*) FROM SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE WHERE processed_at IS NULL);
    IF (v_pending = 0) THEN
        RETURN OBJECT_CONSTRUCT(
            'events_written', 0,
            'pending_bundles', 0,
            'flattened_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS'),
            'note', 'no unprocessed FHIR bundles - task is idle until bundles land (blocked on REMAINING-WORK.md gap 11 - per-patient FHIR generation)'
        );
    END IF;

    -- Cursor-per-bundle pattern chosen over MERGE-USING-CTE-with-LATERAL because
    -- Snowflake's MERGE-USING clause does not support correlated LATERAL FLATTEN
    -- or scalar subqueries. Verified live 23 Sept: 'Unsupported subquery type
    -- cannot be evaluated at line 10'. Per-bundle iteration is slower but correct.
    OPEN c_bundles;
    FETCH c_bundles INTO v_bundle_id, v_payload, v_source_id;
    WHILE (v_bundle_id IS NOT NULL) DO
        v_patient_id := COALESCE(
            (SELECT p.value:resource:id::VARCHAR
               FROM TABLE(FLATTEN(input => :v_payload:entry)) p
              WHERE p.value:resource:resourceType::VARCHAR = 'Patient'
              LIMIT 1),
            v_source_id
        );

        INSERT INTO SAARTHI.CORE.CLINICAL_EVENT
            (event_id, patient_id, encounter_id, event_type, code, code_system, display, value_num, unit, event_time, status, ingested_at)
        SELECT
            e.value:resource:id::VARCHAR,
            :v_patient_id,
            NULL,
            CASE e.value:resource:resourceType::VARCHAR
                WHEN 'Observation' THEN 'lab'
                WHEN 'DiagnosticReport' THEN 'pathology'
                WHEN 'ImagingStudy' THEN 'imaging'
                WHEN 'MedicationAdministration' THEN 'medication'
                WHEN 'Procedure' THEN 'procedure'
                WHEN 'Condition' THEN 'diagnosis'
                ELSE 'other'
            END,
            e.value:resource:code:coding[0]:code::VARCHAR,
            e.value:resource:code:coding[0]:system::VARCHAR,
            e.value:resource:code:coding[0]:display::VARCHAR,
            e.value:resource:valueQuantity:value::FLOAT,
            e.value:resource:valueQuantity:unit::VARCHAR,
            e.value:resource:effectiveDateTime::TIMESTAMP_NTZ,
            e.value:resource:status::VARCHAR,
            CURRENT_TIMESTAMP()
          FROM TABLE(FLATTEN(input => :v_payload:entry)) e
         WHERE e.value:resource:resourceType::VARCHAR
               IN ('Observation','DiagnosticReport','ImagingStudy','MedicationAdministration','Procedure','Condition')
           AND NOT EXISTS (
               SELECT 1 FROM SAARTHI.CORE.CLINICAL_EVENT ce
                WHERE ce.event_id = e.value:resource:id::VARCHAR
                  AND ce.patient_id = :v_patient_id
           );

        v_events_written := v_events_written + SQLROWCOUNT;
        UPDATE SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE SET processed_at = CURRENT_TIMESTAMP() WHERE bundle_id = :v_bundle_id;
        FETCH c_bundles INTO v_bundle_id, v_payload, v_source_id;
    END WHILE;
    CLOSE c_bundles;

    RETURN OBJECT_CONSTRUCT(
        'events_written', v_events_written,
        'pending_bundles', v_pending,
        'flattened_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );
END;
$$;

CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_FLATTEN_FHIR
  WAREHOUSE = SAARTHI_AI_WH
  TIMEZONE = 'UTC'
  SCHEDULE = '15 MINUTE'
AS
  CALL SAARTHI.OPERATIONAL.flatten_fhir_proc();
