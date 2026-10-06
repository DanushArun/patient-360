-- =============================================================================
-- DEMO HERO - PAT-DC-12 Anjali Deshpande (synthetic)
-- =============================================================================
-- One patient whose record exercises every part of PS-04 in a single visit:
-- structured records from four sources, five source documents for R7 two-pass
-- extraction, a safety rule, a regulatory/coverage conflict, cross-specimen
-- discordance surfaced without auto-resolution, and a Class A refusal path.
-- Every name, identifier and value is synthetic.
--
-- What this file does NOT do: decide any outcome (R1). Expected outcomes, all
-- computed by evaluate_gates from these rows:
--   SURV-LVEF-002  fail         LVEF 63% -> 49% (below 50, drop >= 10): trastuzumab hold criterion met
--   COV-AUTH-001   conflicting  pre-auth table 'pending', insurer letter 'approved'
--   DOC-DISC-001   pass         HER2 2+ (outside core biopsy) vs 3+ (surgical): both surfaced
--   everything else pass        ANC derived 3,016 (WBC 5,800 x 52%), PLT 2,28,000, CrCl, bilirubin
--
-- Dates are relative to CURRENT_DATE() and re-anchored on every run (WHEN MATCHED
-- ... UPDATE), exactly like load_daycare_cohort.sql, so "tomorrow" is tomorrow on
-- any demo day. Document page text is generated here from the same anchor, so a
-- printed report date always equals the event it reports. Dates print as
-- YYYY-MM-DD (fixed width): re-anchoring never moves a cited character span.
--
-- Run as ACCOUNTADMIN after the base install. Re-runnable; changes nothing when
-- run twice on the same day.

SET hero_anchor = (SELECT DATEADD(minute, 570, DATEADD(day, 1, CURRENT_DATE()))::TIMESTAMP_NTZ);
SET hero_cap = (SELECT DATEADD(hour, -3, CURRENT_TIMESTAMP()::TIMESTAMP_NTZ));

-- ---- identity & governance ----------------------------------------------------

MERGE INTO SAARTHI.CORE.PATIENT t
USING (SELECT 'PAT-DC-12' AS patient_id) s ON t.patient_id = s.patient_id
WHEN NOT MATCHED THEN INSERT (patient_id, abha_ref, name, dob, gender, district, state, primary_language)
VALUES ('PAT-DC-12', 'ABHA-SYN-12', 'Anjali Deshpande', '1980-03-14', 'female', 'Pune', 'Maharashtra', 'Marathi');

MERGE INTO SAARTHI.GOVERNANCE.CARE_TEAM t
USING (SELECT 'PAT-DC-12' AS patient_id) s
ON t.practitioner_id = 'PRAC-01' AND t.patient_id = s.patient_id AND t.facility_id = 'FAC-02' AND t.role_type = 'treating'
WHEN NOT MATCHED THEN INSERT (care_team_id, practitioner_id, patient_id, facility_id, role_type, active_from, granted_by)
VALUES (UUID_STRING(), 'PRAC-01', 'PAT-DC-12', 'FAC-02', 'treating', DATEADD(day, -160, CURRENT_DATE()), 'PRAC-01');

MERGE INTO SAARTHI.GOVERNANCE.CONSENT t
USING (SELECT 'CON-DC-12' AS consent_id) s ON t.consent_id = s.consent_id
WHEN NOT MATCHED THEN INSERT (consent_id, patient_id, granted_to_facility_id, granted_by, grantor_name,
  purpose_code, data_categories, valid_from, valid_until, status)
VALUES ('CON-DC-12', 'PAT-DC-12', 'FAC-02', 'patient', 'Anjali Deshpande',
  'treatment', ARRAY_CONSTRUCT('clinical','identity','financial'), DATEADD(day, -160, CURRENT_TIMESTAMP()), NULL, 'active');

-- Four records, one person (R4): ABHA plus three hospital identifiers, each linked
-- by ABHA or by a recorded manual verification, never by name.
MERGE INTO SAARTHI.CORE.ID_MAP t
USING (SELECT column1 AS map_id, column2 AS source_system, column3 AS source_patient_id, column4 AS link_status
         FROM VALUES ('DC-12-ABHA',   'ABHA',       'ABHA-SYN-12', 'abha_linked'),
                     ('DC-12-MRN',    'FAC-02-MRN', 'MRN-710012',  'manually_verified'),
                     ('DC-12-APOLLO', 'FAC-01-MRN', 'APL-448210',  'manually_verified'),
                     ('DC-12-HCG',    'FAC-04-MRN', 'HCG-903174',  'manually_verified')) s
ON t.map_id = s.map_id
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at)
VALUES (s.map_id, 'PAT-DC-12', s.source_system, s.source_patient_id, s.link_status, CURRENT_TIMESTAMP());

-- ---- encounters: six completed weekly cycles, cycle 7 tomorrow ------------------

MERGE INTO SAARTHI.CORE.ENCOUNTER t
USING (
  SELECT 'ENC-DC-12' || IFF(c.cycle = 7, '', '-C' || c.cycle) AS encounter_id, c.cycle,
         DATEADD(day, -7 * (7 - c.cycle), $hero_anchor) AS at
    FROM (SELECT column1 AS cycle FROM VALUES (1),(2),(3),(4),(5),(6),(7)) c
) s ON t.encounter_id = s.encounter_id
WHEN MATCHED THEN UPDATE SET t.scheduled_time = s.at,
  t.event_time = IFF(s.cycle = 7, NULL, s.at), t.status = IFF(s.cycle = 7, 'scheduled', 'completed')
WHEN NOT MATCHED THEN INSERT (encounter_id, patient_id, facility_id, department_id, encounter_type,
  scheduled_time, event_time, cycle_number, status, gap_type)
VALUES (s.encounter_id, 'PAT-DC-12', 'FAC-02', 'DEPT-ONC-02', 'daycare',
  s.at, IFF(s.cycle = 7, NULL, s.at), s.cycle, IFF(s.cycle = 7, 'scheduled', 'completed'), 'none');

-- ---- plan & coverage --------------------------------------------------------------

MERGE INTO SAARTHI.CORE.TREATMENT_PLAN t
USING (SELECT 'PLAN-DC-12' AS plan_id) s ON t.plan_id = s.plan_id
WHEN NOT MATCHED THEN INSERT (plan_id, patient_id, version, regimen_code, regimen_display, intent,
  planned_cycles, decided_at, decided_by_practitioner_id, decision_forum)
VALUES ('PLAN-DC-12', 'PAT-DC-12', 1, 'TH', 'Paclitaxel + trastuzumab, weekly', 'curative',
  12, DATEADD(day, -120, CURRENT_TIMESTAMP()), 'PRAC-01', 'tumour_board');

MERGE INTO SAARTHI.CORE.COVERAGE t
USING (SELECT 'COV-DC-12' AS coverage_id) s ON t.coverage_id = s.coverage_id
WHEN NOT MATCHED THEN INSERT (coverage_id, patient_id, payer_type, payer_name, policy_number,
  is_family_floater, effective_from, effective_to, annual_limit, used_amount, priority, portability)
VALUES ('COV-DC-12', 'PAT-DC-12', 'scheme', 'PM-JAY', 'PMJAY-7112',
  TRUE, DATEADD(day, -365, CURRENT_DATE()), DATEADD(day, 365, CURRENT_DATE()), 500000, 165000, 1, 'within_state');

-- The TPA table still says pending; the insurer's letter (DOC-PA-DC-12) says approved.
MERGE INTO SAARTHI.CORE.AUTHORIZATION t
USING (SELECT 'PA-DC-12' AS auth_id) s ON t.auth_id = s.auth_id
WHEN MATCHED THEN UPDATE SET t.requested_at = DATEADD(day, -4, $hero_anchor),
  t.expires_at = DATEADD(day, 60, $hero_anchor)
WHEN NOT MATCHED THEN INSERT (auth_id, patient_id, encounter_id, coverage_id, scheme, package_code,
  package_display, status, letter_status, requested_at, decided_at, expires_at, reviewed_by)
VALUES ('PA-DC-12', 'PAT-DC-12', 'ENC-DC-12', 'COV-DC-12', 'PM-JAY', 'MO-CHEMO-DC',
  'Medical oncology - day-care chemotherapy cycle', 'pending', 'approved',
  DATEADD(day, -4, $hero_anchor), NULL, DATEADD(day, 60, $hero_anchor), NULL);

-- ---- clinical evidence ------------------------------------------------------------
-- days_before is measured back from tomorrow's encounter.

CREATE OR REPLACE TEMPORARY TABLE SAARTHI.OPERATIONAL._HERO_EVENTS AS
SELECT column1 AS sfx, column2 AS event_type, column3 AS concept, column4::FLOAT AS days_before,
       column5::FLOAT AS value_num, column6 AS value_text, column7 AS unit, column8 AS code_system,
       column9 AS code, column10 AS display, column11 AS specimen
FROM VALUES
  ('DX',    'diagnosis', NULL,            150, NULL,   NULL,               NULL,    'ICD-10','C50.4',   'Carcinoma breast, HER2 positive', NULL),
  ('HER2B', 'pathology', 'HER2_IHC',      142, NULL,   'grade=III ihc=2+', NULL,    'LOINC', '18474-7', 'HER2 IHC (outside core biopsy)', 'SPEC-DC-12-CORE'),
  ('HER2',  'pathology', 'HER2_IHC',      128, NULL,   'grade=III ihc=3+', NULL,    'LOINC', '18474-7', 'HER2 IHC (surgical specimen)', 'SPEC-DC-12'),
  ('LVEF0', 'imaging',   'LVEF',          112, 63,     NULL,               '%',     'LOINC', '10230-1', 'LVEF (echo, baseline)', NULL),
  ('DEXA',  'imaging',   'T_SCORE',        70, -1.2,   NULL,               NULL,    'LOINC', '38263-0', 'DEXA T-score', NULL),
  ('A1C',   'lab',       'HBA1C',          26, 6.1,    NULL,               '%',     'LOINC', '4548-4',  'HbA1c', NULL),
  ('LVEF1', 'imaging',   'LVEF',            4, 49,     NULL,               '%',     'LOINC', '10230-1', 'LVEF (echo)', NULL),
  ('HB',    'lab',       'HEMOGLOBIN',    0.7, 10.8,   NULL,               'g/dL',  'LOINC', '718-7',   'Haemoglobin', 'SPEC-DC-12-CBC'),
  ('WBC',   'lab',       'WBC',           0.7, 5800,   NULL,               '/cumm', 'LOINC', '6690-2',  'WBC', 'SPEC-DC-12-CBC'),
  ('NEUT',  'lab',       'NEUTROPHIL_PCT',0.7, 52,     NULL,               '%',     'LOINC', '770-8',   'Neutrophils %', 'SPEC-DC-12-CBC'),
  ('PLT',   'lab',       'PLT',           0.7, 228000, NULL,               '/cumm', 'LOINC', '777-3',   'Platelets', 'SPEC-DC-12-CBC'),
  ('CREAT', 'lab',       'CREATININE',    0.7, 0.8,    NULL,               'mg/dL', 'LOINC', '2160-0',  'Creatinine', NULL),
  ('BILI',  'lab',       'BILIRUBIN',     0.7, 0.6,    NULL,               'mg/dL', 'LOINC', '1975-2',  'Bilirubin total', NULL),
  ('AST',   'lab',       'AST',           0.7, 27,     NULL,               'U/L',   'LOINC', '1920-8',  'AST', NULL),
  ('ALT',   'lab',       'ALT',           0.7, 22,     NULL,               'U/L',   'LOINC', '1742-6',  'ALT', NULL),
  ('WT',    'vitals',    'WEIGHT',        0.7, 61,     NULL,               'kg',    'LOINC', '29463-7', 'Body weight', NULL);

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (
  SELECT 'EVT-DC-12-' || e.sfx AS event_id, o.concept_id, e.event_type, e.code_system, e.code,
         e.display, e.value_num, e.value_text, e.unit, e.specimen,
         LEAST(DATEADD(minute, -ROUND(e.days_before * 1440), $hero_anchor)::TIMESTAMP_NTZ, $hero_cap) AS event_time
    FROM SAARTHI.OPERATIONAL._HERO_EVENTS e
    LEFT JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY o ON o.canonical_name = e.concept
) s ON t.event_id = s.event_id
WHEN MATCHED THEN UPDATE SET
  t.concept_id = s.concept_id, t.event_time = s.event_time,
  t.source_recorded_at = DATEADD(hour, 3, s.event_time),
  -- R2: re-stamp ingestion only when the fixture is re-anchored (see load_daycare_cohort.sql).
  t.ingested_at = IFF(t.event_time = s.event_time, t.ingested_at, CURRENT_TIMESTAMP())
WHEN NOT MATCHED THEN INSERT (event_id, patient_id, encounter_id, event_type, concept_id, code_system, code,
  display, value_num, value_text, unit, original_value, original_unit, abnormal_flag, specimen_id,
  accession_id, status, negation, event_time, source_recorded_at, ingested_at, valid_until)
VALUES (s.event_id, 'PAT-DC-12', 'ENC-DC-12', s.event_type, s.concept_id, s.code_system, s.code,
  s.display, s.value_num, s.value_text, s.unit, COALESCE(s.value_num::VARCHAR, s.value_text), s.unit, NULL,
  s.specimen, 'ACC-' || s.event_id, 'final', FALSE, s.event_time, DATEADD(hour, 3, s.event_time),
  CURRENT_TIMESTAMP(), NULL);

-- ---- source documents ---------------------------------------------------------------
-- Five documents from three hospitals and the payer. Page text is built from the
-- same anchor as the events above, so each printed date is its event's date. The
-- R7 extraction task reads these pages; nothing here asserts a value from them.

CREATE OR REPLACE TEMPORARY TABLE SAARTHI.OPERATIONAL._HERO_DOCS AS
SELECT d.doc_id, d.doc_type, d.facility_id, d.at, d.page_text
FROM (
  SELECT 'DOC-LAB-DC-12' AS doc_id, 'lab_report' AS doc_type, 'FAC-02' AS facility_id,
         LEAST(DATEADD(minute, -1008, $hero_anchor)::TIMESTAMP_NTZ, $hero_cap) AS at,
         'Tata Memorial Hospital\nLABORATORY REPORT - SYNTHETIC\nPatient: PAT-DC-12\nReport date: '
           || TO_CHAR(LEAST(DATEADD(minute, -1008, $hero_anchor)::TIMESTAMP_NTZ, $hero_cap), 'YYYY-MM-DD')
           || '\n\nHaemoglobin: 10.8 g/dL\nWBC: 5,800 /cumm\nNeutrophils (differential): 52 %'
           || '\nPlatelet count: 2,28,000 /cumm\nSerum creatinine: 0.8 mg/dL\nTotal bilirubin: 0.6 mg/dL'
           || '\nAST: 27 U/L\nALT: 22 U/L' AS page_text
  UNION ALL
  SELECT 'DOC-ECHO-DC-12', 'imaging_report', 'FAC-04', DATEADD(day, -4, $hero_anchor),
         'HCG Cancer Centre\n2D ECHOCARDIOGRAPHY REPORT - SYNTHETIC\nPatient: PAT-DC-12\nReport date: '
           || TO_CHAR(DATEADD(day, -4, $hero_anchor), 'YYYY-MM-DD')
           || '\nIndication: Cardiac surveillance on trastuzumab\n\nLVEF (biplane Simpson): 49 %'
           || '\nPrevious LVEF: 63 % on ' || TO_CHAR(DATEADD(day, -112, $hero_anchor), 'YYYY-MM-DD')
           || '\nRegional wall motion: mild global hypokinesis\nPericardium: no effusion'
  UNION ALL
  SELECT 'DOC-PATH-DC-12', 'pathology', 'FAC-02', DATEADD(day, -128, $hero_anchor),
         'Tata Memorial Hospital\nHISTOPATHOLOGY REPORT - SYNTHETIC\nPatient: PAT-DC-12\nSpecimen: SPEC-DC-12\nReport date: '
           || TO_CHAR(DATEADD(day, -128, $hero_anchor), 'YYYY-MM-DD')
           || '\n\nSpecimen type: Left mastectomy\nDiagnosis: Invasive ductal carcinoma\nGrade: III\nHER2 IHC: 3+'
  UNION ALL
  SELECT 'DOC-BIOPSY-DC-12', 'pathology', 'FAC-01', DATEADD(day, -142, $hero_anchor),
         'Apollo Cancer Centre\nHISTOPATHOLOGY REPORT - SYNTHETIC\nPatient: PAT-DC-12\nSpecimen: SPEC-DC-12-CORE\nReport date: '
           || TO_CHAR(DATEADD(day, -142, $hero_anchor), 'YYYY-MM-DD')
           || '\n\nSpecimen type: Core needle biopsy, left breast\nGrade: III\nHER2 IHC: 2+ (equivocal)'
  UNION ALL
  -- Received by the treating hospital's TPA desk, so its source facility is FAC-02.
  SELECT 'DOC-PA-DC-12', 'authorization_letter', 'FAC-02', DATEADD(day, -2, $hero_anchor),
         'PM-JAY - Pre-Authorisation Decision\nSYNTHETIC DOCUMENT - NOT A REAL PAYER LETTER\nPatient: PAT-DC-12'
           || '\nPre-auth reference: PA-DC-12\nPackage: Medical oncology - day-care chemotherapy cycle\n\n'
           || 'Authorisation status: APPROVED\nDecision date: ' || TO_CHAR(DATEADD(day, -2, $hero_anchor), 'YYYY-MM-DD')
           || '\nValid until: ' || TO_CHAR(DATEADD(day, 60, $hero_anchor), 'YYYY-MM-DD')
) d;

MERGE INTO SAARTHI.DOCUMENTS.DOCUMENT t
USING SAARTHI.OPERATIONAL._HERO_DOCS s ON t.doc_id = s.doc_id
WHEN MATCHED THEN UPDATE SET t.signed_at = DATEADD(hour, 3, s.at), t.effective_at = s.at
WHEN NOT MATCHED THEN INSERT (doc_id, patient_id, scope, doc_type, version, file_hash, source_path,
  source_quality, signed_at, effective_at, ingested_at, source_facility_id, ingestion_method, status)
VALUES (s.doc_id, 'PAT-DC-12', 'patient', s.doc_type, 1, SHA2(s.doc_id || ':demo-hero-v1'),
  'PAT-DC-12/' || s.doc_id, 'clean_pdf', DATEADD(hour, 3, s.at), s.at, CURRENT_TIMESTAMP(),
  s.facility_id, 'digital_emr', 'active');

-- Re-anchoring changes only the fixed-width dates in the text, so a matched page keeps its
-- assertions and their character spans; extraction is never re-run by a re-anchor.
MERGE INTO SAARTHI.DOCUMENTS.DOC_PAGE t
USING SAARTHI.OPERATIONAL._HERO_DOCS s ON t.doc_id = s.doc_id AND t.page_index = 0
WHEN MATCHED AND t.text != s.page_text AND LENGTH(t.text) = LENGTH(s.page_text)
  THEN UPDATE SET t.text = s.page_text
WHEN NOT MATCHED THEN INSERT (doc_id, page_index, text, char_count)
VALUES (s.doc_id, 0, s.page_text, LENGTH(s.page_text));
