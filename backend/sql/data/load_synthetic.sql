-- =============================================================================
-- STEP 12a - Reference/governance data for the deep-case patient
-- =============================================================================
-- WORK-PLAN.md Day 2-3 "Governance live". Loads the organisational scaffold
-- and the deep-case patient's identity so bind_patient + CARE_TEAM + CONSENT
-- are testable end to end. Structured clinical events (Day 4-5) load
-- separately via the CSV -> DT_HARMONIZED_EVENTS path once that pipeline
-- exists (steps 13-15) - this file only carries reference/identity data.
-- MERGE throughout: setup.sql must run clean a second time.

MERGE INTO SAARTHI.GOVERNANCE.ORGANIZATION t USING (SELECT 'ORG-01' org_id) s ON t.org_id = s.org_id
WHEN NOT MATCHED THEN INSERT (org_id, name, type, state) VALUES ('ORG-01', 'SAARTHI Care Network', 'hospital_network', NULL);

MERGE INTO SAARTHI.GOVERNANCE.FACILITY t USING (SELECT 'FAC-01' facility_id) s ON t.facility_id = s.facility_id
WHEN NOT MATCHED THEN INSERT (facility_id, org_id, name, facility_type, district, state) VALUES ('FAC-01', 'ORG-01', 'Apollo Cancer Centre', 'hub', 'Chennai', 'Tamil Nadu');
MERGE INTO SAARTHI.GOVERNANCE.FACILITY t USING (SELECT 'FAC-02' facility_id) s ON t.facility_id = s.facility_id
WHEN NOT MATCHED THEN INSERT (facility_id, org_id, name, facility_type, district, state) VALUES ('FAC-02', 'ORG-01', 'Tata Memorial Hospital', 'hub', 'Mumbai', 'Maharashtra');
MERGE INTO SAARTHI.GOVERNANCE.FACILITY t USING (SELECT 'FAC-03' facility_id) s ON t.facility_id = s.facility_id
WHEN NOT MATCHED THEN INSERT (facility_id, org_id, name, facility_type, district, state) VALUES ('FAC-03', 'ORG-01', 'AIIMS', 'spoke', 'New Delhi', 'Delhi');
MERGE INTO SAARTHI.GOVERNANCE.FACILITY t USING (SELECT 'FAC-04' facility_id) s ON t.facility_id = s.facility_id
WHEN NOT MATCHED THEN INSERT (facility_id, org_id, name, facility_type, district, state) VALUES ('FAC-04', 'ORG-01', 'HCG Cancer Centre', 'spoke', 'Bengaluru', 'Karnataka');

MERGE INTO SAARTHI.GOVERNANCE.DEPARTMENT t USING (SELECT 'DEPT-ONC-02' department_id) s ON t.department_id = s.department_id
WHEN NOT MATCHED THEN INSERT (department_id, facility_id, specialty, name) VALUES ('DEPT-ONC-02', 'FAC-02', 'medical_oncology', 'Medical Oncology');

-- Test practitioner mapped to the ACTUAL Snowflake user running this session,
-- so bind_patient/CURRENT_USER() resolve to a real row (F3's join).
MERGE INTO SAARTHI.GOVERNANCE.PRACTITIONER t USING (SELECT 'PRAC-01' practitioner_id) s ON t.practitioner_id = s.practitioner_id
WHEN NOT MATCHED THEN INSERT (practitioner_id, facility_id, department_id, name, nmc_registration_no, qualification, snowflake_user, active)
VALUES ('PRAC-01', 'FAC-02', 'DEPT-ONC-02', 'Dr. Test Oncologist', 'NMC-TEST-0001', 'MD Oncology', CURRENT_USER(), TRUE);

-- A second practitioner with NO relationship to the deep-case patient, for
-- the cross-scope negative test (WORK-PLAN.md Day 2-3 test 2).
MERGE INTO SAARTHI.GOVERNANCE.PRACTITIONER t USING (SELECT 'PRAC-02' practitioner_id) s ON t.practitioner_id = s.practitioner_id
WHEN NOT MATCHED THEN INSERT (practitioner_id, facility_id, department_id, name, nmc_registration_no, qualification, snowflake_user, active)
VALUES ('PRAC-02', 'FAC-01', NULL, 'Dr. Unrelated Practitioner', 'NMC-TEST-0002', 'MD', 'NO_SUCH_USER', TRUE);

MERGE INTO SAARTHI.CORE.PATIENT t USING (SELECT 'PAT-DEEP-0001' patient_id) s ON t.patient_id = s.patient_id
WHEN NOT MATCHED THEN INSERT (patient_id, abha_ref, name, dob, gender, district, state, primary_language)
VALUES ('PAT-DEEP-0001', NULL, 'Meera Iyer', '1978-04-12', 'female', 'Mumbai', 'Maharashtra', 'Marathi');

MERGE INTO SAARTHI.GOVERNANCE.CARE_TEAM t
USING (SELECT 'PRAC-01' practitioner_id, 'PAT-DEEP-0001' patient_id, 'FAC-02' facility_id, 'treating' role_type) s
ON t.practitioner_id = s.practitioner_id AND t.patient_id = s.patient_id AND t.facility_id = s.facility_id AND t.role_type = s.role_type
WHEN NOT MATCHED THEN INSERT (care_team_id, practitioner_id, patient_id, facility_id, role_type, active_from, granted_by)
VALUES (UUID_STRING(), 'PRAC-01', 'PAT-DEEP-0001', 'FAC-02', 'treating', DATEADD(day, -180, CURRENT_DATE()), 'PRAC-01');

MERGE INTO SAARTHI.GOVERNANCE.CONSENT t USING (SELECT 'CON-DEEP-0001' consent_id) s ON t.consent_id = s.consent_id
WHEN NOT MATCHED THEN INSERT (consent_id, patient_id, granted_to_facility_id, granted_by, grantor_name,
  purpose_code, data_categories, valid_from, valid_until, status)
VALUES ('CON-DEEP-0001', 'PAT-DEEP-0001', 'FAC-02', 'patient', 'Meera Iyer',
  'treatment', ARRAY_CONSTRUCT('clinical','identity'), DATEADD(day, -180, CURRENT_TIMESTAMP()), NULL, 'active');

-- 7 identifiers, 0 ABHA (R4's design centre) - matches data/generator/ledger.py exactly.
MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'FAC-01-MRN' k) s ON t.map_id = s.k
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at) VALUES ('FAC-01-MRN', 'PAT-DEEP-0001', 'FAC-01-MRN', 'MRN-800000', 'manually_verified', CURRENT_TIMESTAMP());
MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'FAC-01-LAB' k) s ON t.map_id = s.k
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at) VALUES ('FAC-01-LAB', 'PAT-DEEP-0001', 'FAC-01-LAB_ACCESSION_ID', 'LAB_ACCESSION_ID-800001', 'manually_verified', CURRENT_TIMESTAMP());
MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'FAC-02-MRN' k) s ON t.map_id = s.k
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at) VALUES ('FAC-02-MRN', 'PAT-DEEP-0001', 'FAC-02-MRN', 'MRN-800002', 'manually_verified', CURRENT_TIMESTAMP());
MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'FAC-02-UHID' k) s ON t.map_id = s.k
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at) VALUES ('FAC-02-UHID', 'PAT-DEEP-0001', 'FAC-02-UHID', 'UHID-800003', 'manually_verified', CURRENT_TIMESTAMP());
MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'FAC-03-MRN' k) s ON t.map_id = s.k
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at) VALUES ('FAC-03-MRN', 'PAT-DEEP-0001', 'FAC-03-MRN', 'MRN-800004', 'manually_verified', CURRENT_TIMESTAMP());
MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'FAC-04-MRN' k) s ON t.map_id = s.k
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at) VALUES ('FAC-04-MRN', 'PAT-DEEP-0001', 'FAC-04-MRN', 'MRN-800005', 'manually_verified', CURRENT_TIMESTAMP());
MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'FAC-04-INS' k) s ON t.map_id = s.k
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at) VALUES ('FAC-04-INS', 'PAT-DEEP-0001', 'FAC-04-INSURANCE_MEMBER_ID', 'INSURANCE_MEMBER_ID-800006', 'manually_verified', CURRENT_TIMESTAMP());

-- =============================================================================
-- STEP 12c - LVEF + HbA1c clinical events for the deep-case patient
-- =============================================================================
-- ledger.py does not emit LVEF or HbA1c events (REMAINING-WORK.md §5 gap 7 -
-- extending the ledger to emit these hits 12+8+9 test files and multiple pipeline
-- files, deferred to Danush). Seeding directly here with concept_ids from
-- CLINICAL_ONTOLOGY so DT_HARMONIZED_EVENTS.concept_name resolves to
-- 'LVEF' and 'HBA1C' via the LEFT JOIN in that Dynamic Table's DDL.
--
-- Freshness anchor: the latest chemo encounter (EVT-CHEMO-06) is scheduled
-- 2025-05-23. Events are dated 2025-04-15 - 38 days before the encounter, so
-- both rules (SURV-LVEF-001 max_age_days=90 and ENDO-HBA1C-001 max_age_days=90)
-- see them as fresh.
--
-- Values chosen to exercise the pass paths (LVEF 58% >= 50 threshold; HbA1c 7.2%
-- < 8.5 threshold). The corresponding fail scenarios are covered by the rule
-- fixture corpus at data/fixtures/rules/rule_fixtures.yaml.

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (SELECT 'EVT-LVEF-01' AS event_id) s ON t.event_id = s.event_id
WHEN NOT MATCHED THEN INSERT (
  event_id, patient_id, encounter_id, event_type, concept_id,
  code_system, code, display, value_num, value_text, unit,
  original_value, original_unit, abnormal_flag, specimen_id, accession_id,
  status, negation, event_time, source_recorded_at, ingested_at, valid_until
) VALUES (
  'EVT-LVEF-01', 'PAT-DEEP-0001', 'EVT-CHEMO-06', 'imaging',
  '047c1aee-f5ff-415b-9f44-1d222bd96b18',  -- LVEF concept_id
  'LOINC', '10230-1', 'Left ventricular Ejection fraction',
  58, NULL, '%', '58', '%', NULL, NULL, 'ECHO-2025-0418',
  'final', FALSE,
  TIMESTAMP_NTZ_FROM_PARTS(2025, 4, 15, 10, 30, 0),
  TIMESTAMP_NTZ_FROM_PARTS(2025, 4, 15, 12, 0, 0),
  CURRENT_TIMESTAMP(), NULL
);

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (SELECT 'EVT-HBA1C-01' AS event_id) s ON t.event_id = s.event_id
WHEN NOT MATCHED THEN INSERT (
  event_id, patient_id, encounter_id, event_type, concept_id,
  code_system, code, display, value_num, value_text, unit,
  original_value, original_unit, abnormal_flag, specimen_id, accession_id,
  status, negation, event_time, source_recorded_at, ingested_at, valid_until
) VALUES (
  'EVT-HBA1C-01', 'PAT-DEEP-0001', 'EVT-CHEMO-06', 'lab',
  'e695965e-646b-44c0-94c0-be884b8739e7',  -- HBA1C concept_id
  'LOINC', '4548-4', 'Hemoglobin A1c/Hemoglobin.total in Blood',
  7.2, NULL, '%', '7.2', '%', NULL, NULL, 'LAB-2025-0415-HBA1C',
  'final', FALSE,
  TIMESTAMP_NTZ_FROM_PARTS(2025, 4, 15, 9, 15, 0),
  TIMESTAMP_NTZ_FROM_PARTS(2025, 4, 15, 11, 30, 0),
  CURRENT_TIMESTAMP(), NULL
);

