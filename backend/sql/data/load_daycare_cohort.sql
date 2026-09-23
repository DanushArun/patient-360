-- =============================================================================
-- STEP 12f - Day-care cohort: tomorrow's chemotherapy list
-- =============================================================================
-- Eleven synthetic patients with a day-care encounter scheduled for tomorrow,
-- so the coordinator's home screen has a real list to triage. Every name,
-- identifier and value here is synthetic.
--
-- What this file does NOT do: decide any outcome. It seeds evidence only; every
-- pass/fail/not_evaluated/conflicting on the list comes from evaluate_gates
-- reading these rows (R1). Each patient is shaped around one blocker that
-- stops real Indian day-care chairs:
--   DC-01 ready                       DC-07 pre-auth table says pending, letter says approved
--   DC-02 LVEF overdue on trastuzumab DC-08 no CBC on record at all (missing, not low)
--   DC-03 CBC 11 days old             DC-09 HbA1c 9.4 - advisory only, not a blocker
--   DC-04 platelets 82,000            DC-10 HER2 IHC 2+, FISH not back
--   DC-05 ANC 1,150                   DC-11 ready
--   DC-06 PM-JAY pre-auth pending
--
-- Regimens are clinically coherent: trastuzumab only where HER2 is 3+. Each
-- regimen_code is a REGIMEN_REGISTRY row pointing at its governing protocol;
-- cisplatin with radiation is split by site (CIS-RT-HN / CIS-RT-CX) because
-- the head-and-neck and cervix protocols set different thresholds.
--
-- Dates are relative to CURRENT_DATE() and re-anchored on every deploy
-- (WHEN MATCHED ... UPDATE), so "tomorrow" is tomorrow whichever day this runs.
-- Ages of evidence are fixed relative to the encounter, so outcomes are stable.

CREATE OR REPLACE TEMPORARY TABLE SAARTHI.OPERATIONAL._DC_COHORT AS
SELECT column1 AS k, column2 AS name, column3::DATE AS dob, column4 AS gender,
       column5 AS district, column6 AS state, column7 AS language,
       column8 AS icd10, column9 AS diagnosis, column10 AS regimen_code, column11 AS regimen,
       column12::INT AS cycle, column13::BOOLEAN AS abha, column14 AS pa_status, column15 AS pa_letter
FROM VALUES
  ('01','Sunita Devi',      '1974-03-11','female','Varanasi',     'Uttar Pradesh','Hindi',  'C50.9','Carcinoma breast, HER2 positive',   'TH',     'Paclitaxel + trastuzumab, weekly',          7, TRUE,  'approved','approved'),
  ('02','Lakshmi Narayanan','1979-08-02','female','Madurai',      'Tamil Nadu',   'Tamil',  'C50.4','Carcinoma breast, HER2 positive',   'H-MAINT','Trastuzumab maintenance, 3-weekly',        9, FALSE, 'approved','approved'),
  ('03','Rakesh Kumar Yadav','1968-01-19','male', 'Gaya',         'Bihar',        'Hindi',  'C18.7','Adenocarcinoma sigmoid colon',      'FOLFOX', 'FOLFOX, 2-weekly',                         5, FALSE, 'approved','approved'),
  ('04','Fatima Begum',     '1982-06-25','female','Murshidabad',  'West Bengal',  'Bengali','C50.9','Carcinoma breast, HER2 negative',   'AC',     'Doxorubicin + cyclophosphamide, 3-weekly', 3, TRUE,  'approved','approved'),
  ('05','Suresh Patil',     '1965-11-04','male',  'Latur',        'Maharashtra',  'Marathi','C10.9','Squamous carcinoma oropharynx',     'CIS-RT-HN','Cisplatin 100 mg/m2 3-weekly with radiotherapy', 2, FALSE, 'approved','approved'),
  ('06','Priya Sharma',     '1987-02-14','female','Jaipur',       'Rajasthan',    'Hindi',  'C50.4','Carcinoma breast, HER2 positive',   'TH',     'Paclitaxel + trastuzumab, weekly',          2, TRUE,  'pending', NULL),
  ('07','Gopal Das',        '1960-09-30','male',  'Kolkata',      'West Bengal',  'Bengali','C34.1','Adenocarcinoma lung, upper lobe',   'PEM-CARBO','Pemetrexed + carboplatin, 3-weekly',     3, FALSE, 'pending', 'approved'),
  ('08','Savitri Bai',      '1971-04-08','female','Nanded',       'Maharashtra',  'Marathi','C53.9','Squamous carcinoma cervix',         'CIS-RT-CX','Cisplatin 40 mg/m2 weekly with radiotherapy', 2, FALSE, 'approved','approved'),
  ('09','Abdul Rahman',     '1976-12-21','male',  'Lucknow',      'Uttar Pradesh','Hindi',  'C16.9','Adenocarcinoma stomach',            'CAPOX',  'Capecitabine + oxaliplatin, 3-weekly',     4, TRUE,  'approved','approved'),
  ('10','Radha Krishnan',   '1981-07-17','female','Chennai',      'Tamil Nadu',   'Tamil',  'C50.9','Carcinoma breast, HER2 equivocal',  'AC',     'Doxorubicin + cyclophosphamide, 3-weekly', 2, FALSE, 'approved','approved'),
  ('11','Mohan Lal',        '1963-05-02','male',  'Agra',         'Uttar Pradesh','Hindi',  'C18.2','Adenocarcinoma ascending colon',    'FOLFOX', 'FOLFOX, 2-weekly',                         8, FALSE, 'approved','approved');

-- Tomorrow, 09:30. Every date below is an offset from this.
SET dc_anchor = (SELECT DATEADD(minute, 570, DATEADD(day, 1, CURRENT_DATE()))::TIMESTAMP_NTZ);

-- ---- identity & governance ----------------------------------------------------

MERGE INTO SAARTHI.CORE.PATIENT t
USING (SELECT 'PAT-DC-' || k AS patient_id, * FROM SAARTHI.OPERATIONAL._DC_COHORT) s ON t.patient_id = s.patient_id
WHEN NOT MATCHED THEN INSERT (patient_id, abha_ref, name, dob, gender, district, state, primary_language)
VALUES (s.patient_id, IFF(s.abha, 'ABHA-SYN-' || s.k, NULL), s.name, s.dob, s.gender, s.district, s.state, s.language);

MERGE INTO SAARTHI.GOVERNANCE.CARE_TEAM t
USING (SELECT 'PAT-DC-' || k AS patient_id FROM SAARTHI.OPERATIONAL._DC_COHORT) s
ON t.practitioner_id = 'PRAC-01' AND t.patient_id = s.patient_id AND t.facility_id = 'FAC-02' AND t.role_type = 'treating'
WHEN NOT MATCHED THEN INSERT (care_team_id, practitioner_id, patient_id, facility_id, role_type, active_from, granted_by)
VALUES (UUID_STRING(), 'PRAC-01', s.patient_id, 'FAC-02', 'treating', DATEADD(day, -120, CURRENT_DATE()), 'PRAC-01');

MERGE INTO SAARTHI.GOVERNANCE.CONSENT t
USING (SELECT 'CON-DC-' || k AS consent_id, 'PAT-DC-' || k AS patient_id, name FROM SAARTHI.OPERATIONAL._DC_COHORT) s
ON t.consent_id = s.consent_id
WHEN NOT MATCHED THEN INSERT (consent_id, patient_id, granted_to_facility_id, granted_by, grantor_name,
  purpose_code, data_categories, valid_from, valid_until, status)
VALUES (s.consent_id, s.patient_id, 'FAC-02', 'patient', s.name,
  'treatment', ARRAY_CONSTRUCT('clinical','identity','financial'), DATEADD(day, -120, CURRENT_TIMESTAMP()), NULL, 'active');

-- Every patient has a hospital MRN; four also have an ABHA link (R4 - most do not).
MERGE INTO SAARTHI.CORE.ID_MAP t
USING (
  SELECT 'DC-' || k || '-MRN' AS map_id, 'PAT-DC-' || k AS patient_id, 'FAC-02-MRN' AS source_system,
         'MRN-7100' || k AS source_patient_id, 'manually_verified' AS link_status FROM SAARTHI.OPERATIONAL._DC_COHORT
  UNION ALL
  SELECT 'DC-' || k || '-ABHA', 'PAT-DC-' || k, 'ABHA', 'ABHA-SYN-' || k, 'abha_linked' FROM SAARTHI.OPERATIONAL._DC_COHORT WHERE abha
) s ON t.map_id = s.map_id
WHEN NOT MATCHED THEN INSERT (map_id, patient_id, source_system, source_patient_id, link_status, linked_at)
VALUES (s.map_id, s.patient_id, s.source_system, s.source_patient_id, s.link_status, CURRENT_TIMESTAMP());

-- ---- tomorrow's encounter -------------------------------------------------------

MERGE INTO SAARTHI.CORE.ENCOUNTER t
USING (SELECT 'ENC-DC-' || k AS encounter_id, 'PAT-DC-' || k AS patient_id, cycle FROM SAARTHI.OPERATIONAL._DC_COHORT) s
ON t.encounter_id = s.encounter_id
WHEN MATCHED THEN UPDATE SET t.scheduled_time = $dc_anchor, t.status = 'scheduled', t.cycle_number = s.cycle
WHEN NOT MATCHED THEN INSERT (encounter_id, patient_id, facility_id, department_id, encounter_type,
  scheduled_time, event_time, cycle_number, status, gap_type)
VALUES (s.encounter_id, s.patient_id, 'FAC-02', 'DEPT-ONC-02', 'daycare',
  $dc_anchor, NULL, s.cycle, 'scheduled', 'none');

-- ---- plan & coverage --------------------------------------------------------------

MERGE INTO SAARTHI.CORE.TREATMENT_PLAN t
USING (SELECT 'PLAN-DC-' || k AS plan_id, 'PAT-DC-' || k AS patient_id, regimen_code, regimen FROM SAARTHI.OPERATIONAL._DC_COHORT) s
ON t.plan_id = s.plan_id
WHEN MATCHED THEN UPDATE SET t.regimen_code = s.regimen_code, t.regimen_display = s.regimen
WHEN NOT MATCHED THEN INSERT (plan_id, patient_id, version, regimen_code, regimen_display, intent,
  planned_cycles, decided_at, decided_by_practitioner_id, decision_forum)
VALUES (s.plan_id, s.patient_id, 1, s.regimen_code, s.regimen, 'curative',
  12, DATEADD(day, -110, CURRENT_TIMESTAMP()), 'PRAC-01', 'tumour_board');

MERGE INTO SAARTHI.CORE.COVERAGE t
USING (SELECT 'COV-DC-' || k AS coverage_id, 'PAT-DC-' || k AS patient_id, k FROM SAARTHI.OPERATIONAL._DC_COHORT) s
ON t.coverage_id = s.coverage_id
WHEN NOT MATCHED THEN INSERT (coverage_id, patient_id, payer_type, payer_name, policy_number,
  is_family_floater, effective_from, effective_to, annual_limit, used_amount, priority, portability)
VALUES (s.coverage_id, s.patient_id, 'scheme', 'PM-JAY', 'PMJAY-71' || s.k,
  TRUE, DATEADD(day, -365, CURRENT_DATE()), DATEADD(day, 365, CURRENT_DATE()), 500000, 120000, 1, 'cross_state');

MERGE INTO SAARTHI.CORE.AUTHORIZATION t
USING (SELECT 'PA-DC-' || k AS auth_id, 'PAT-DC-' || k AS patient_id, 'ENC-DC-' || k AS encounter_id,
              'COV-DC-' || k AS coverage_id, pa_status, pa_letter FROM SAARTHI.OPERATIONAL._DC_COHORT) s
ON t.auth_id = s.auth_id
WHEN MATCHED THEN UPDATE SET t.expires_at = DATEADD(day, 60, CURRENT_TIMESTAMP())
WHEN NOT MATCHED THEN INSERT (auth_id, patient_id, encounter_id, coverage_id, scheme, package_code,
  package_display, status, letter_status, requested_at, decided_at, expires_at, reviewed_by)
VALUES (s.auth_id, s.patient_id, s.encounter_id, s.coverage_id, 'PM-JAY', 'MO-CHEMO-DC',
  'Medical oncology - day-care chemotherapy cycle', s.pa_status, s.pa_letter,
  DATEADD(day, -5, CURRENT_TIMESTAMP()),
  IFF(s.pa_status = 'approved', DATEADD(day, -3, CURRENT_TIMESTAMP()), NULL),
  DATEADD(day, 60, CURRENT_TIMESTAMP()), IFF(s.pa_status = 'approved', 'insurer-reviewer', NULL));

-- ---- clinical evidence ------------------------------------------------------------
-- days_before is measured back from tomorrow's encounter. CBC-day labs are the
-- afternoon before the visit, as in real pre-chemo practice.
--   (patient k, event suffix, event_type, concept, days_before, value_num, value_text,
--    unit, loinc/icd code, display, specimen)

CREATE OR REPLACE TEMPORARY TABLE SAARTHI.OPERATIONAL._DC_EVENTS AS
SELECT column1 AS k, column2 AS sfx, column3 AS event_type, column4 AS concept,
       column5::FLOAT AS days_before, column6::FLOAT AS value_num, column7 AS value_text,
       column8 AS unit, column9 AS code_system, column10 AS code, column11 AS display, column12 AS specimen
FROM VALUES
  -- diagnoses (drive rule applicability: C50 -> breast_cancer rules)
  ('01','DX','diagnosis',NULL,110,NULL,NULL,NULL,'ICD-10','C50.9','Carcinoma breast',NULL),
  ('02','DX','diagnosis',NULL,300,NULL,NULL,NULL,'ICD-10','C50.4','Carcinoma breast',NULL),
  ('03','DX','diagnosis',NULL,90, NULL,NULL,NULL,'ICD-10','C18.7','Carcinoma sigmoid colon',NULL),
  ('04','DX','diagnosis',NULL,70, NULL,NULL,NULL,'ICD-10','C50.9','Carcinoma breast',NULL),
  ('05','DX','diagnosis',NULL,40, NULL,NULL,NULL,'ICD-10','C10.9','Carcinoma oropharynx',NULL),
  ('06','DX','diagnosis',NULL,30, NULL,NULL,NULL,'ICD-10','C50.4','Carcinoma breast',NULL),
  ('07','DX','diagnosis',NULL,60, NULL,NULL,NULL,'ICD-10','C34.1','Carcinoma lung',NULL),
  ('08','DX','diagnosis',NULL,25, NULL,NULL,NULL,'ICD-10','C53.9','Carcinoma cervix',NULL),
  ('09','DX','diagnosis',NULL,80, NULL,NULL,NULL,'ICD-10','C16.9','Carcinoma stomach',NULL),
  ('10','DX','diagnosis',NULL,45, NULL,NULL,NULL,'ICD-10','C50.9','Carcinoma breast',NULL),
  ('11','DX','diagnosis',NULL,160,NULL,NULL,NULL,'ICD-10','C18.2','Carcinoma ascending colon',NULL),
  -- final histopathology (DOC-PATH-001); HER2 IHC for breast (DOC-HER2-001)
  ('01','HER2','pathology','HER2_IHC',115,NULL,'grade=II ihc=3+',NULL,'LOINC','18474-7','HER2 IHC','SPEC-DC-01'),
  ('02','HER2','pathology','HER2_IHC',305,NULL,'grade=III ihc=3+',NULL,'LOINC','18474-7','HER2 IHC','SPEC-DC-02'),
  ('03','HPE','pathology',NULL,95,NULL,'adenocarcinoma, moderately differentiated',NULL,'LOINC','22637-3','Histopathology report','SPEC-DC-03'),
  ('04','HER2','pathology','HER2_IHC',75,NULL,'grade=II ihc=1+',NULL,'LOINC','18474-7','HER2 IHC','SPEC-DC-04'),
  ('05','HPE','pathology',NULL,45,NULL,'squamous cell carcinoma, p16 positive',NULL,'LOINC','22637-3','Histopathology report','SPEC-DC-05'),
  ('06','HER2','pathology','HER2_IHC',35,NULL,'grade=III ihc=3+',NULL,'LOINC','18474-7','HER2 IHC','SPEC-DC-06'),
  ('07','HPE','pathology',NULL,65,NULL,'adenocarcinoma, EGFR not mutated',NULL,'LOINC','22637-3','Histopathology report','SPEC-DC-07'),
  ('08','HPE','pathology',NULL,30,NULL,'squamous cell carcinoma, keratinising',NULL,'LOINC','22637-3','Histopathology report','SPEC-DC-08'),
  ('09','HPE','pathology',NULL,85,NULL,'adenocarcinoma, intestinal type',NULL,'LOINC','22637-3','Histopathology report','SPEC-DC-09'),
  ('10','HER2','pathology','HER2_IHC',50,NULL,'grade=III ihc=2+',NULL,'LOINC','18474-7','HER2 IHC','SPEC-DC-10'),
  ('11','HPE','pathology',NULL,165,NULL,'adenocarcinoma, well differentiated',NULL,'LOINC','22637-3','Histopathology report','SPEC-DC-11'),
  -- CBC: WBC + neutrophil% (ANC is derived by DT_HARMONIZED_EVENTS) + platelets.
  -- DC-03 drew it 11 days out; DC-04 platelets low; DC-05 ANC low; DC-08 has none.
  ('01','WBC','lab','WBC',0.7,6200,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('01','NEUT','lab','NEUTROPHIL_PCT',0.7,58,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('01','PLT','lab','PLT',0.7,210000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('02','WBC','lab','WBC',0.7,5800,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('02','NEUT','lab','NEUTROPHIL_PCT',0.7,55,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('02','PLT','lab','PLT',0.7,245000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('03','WBC','lab','WBC',11,5400,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('03','NEUT','lab','NEUTROPHIL_PCT',11,52,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('03','PLT','lab','PLT',11,168000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('04','WBC','lab','WBC',0.7,4600,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('04','NEUT','lab','NEUTROPHIL_PCT',0.7,48,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('04','PLT','lab','PLT',0.7,82000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('05','WBC','lab','WBC',0.7,2900,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('05','NEUT','lab','NEUTROPHIL_PCT',0.7,40,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('05','PLT','lab','PLT',0.7,156000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('06','WBC','lab','WBC',0.7,6900,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('06','NEUT','lab','NEUTROPHIL_PCT',0.7,61,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('06','PLT','lab','PLT',0.7,232000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('07','WBC','lab','WBC',0.7,7100,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('07','NEUT','lab','NEUTROPHIL_PCT',0.7,63,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('07','PLT','lab','PLT',0.7,198000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('09','WBC','lab','WBC',0.7,6400,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('09','NEUT','lab','NEUTROPHIL_PCT',0.7,57,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('09','PLT','lab','PLT',0.7,221000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('10','WBC','lab','WBC',0.7,5900,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('10','NEUT','lab','NEUTROPHIL_PCT',0.7,56,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('10','PLT','lab','PLT',0.7,240000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  ('11','WBC','lab','WBC',0.7,6600,NULL,'/cumm','LOINC','6690-2','WBC',NULL),
  ('11','NEUT','lab','NEUTROPHIL_PCT',0.7,60,NULL,'%','LOINC','770-8','Neutrophils %',NULL),
  ('11','PLT','lab','PLT',0.7,205000,NULL,'/cumm','LOINC','777-3','Platelets',NULL),
  -- renal/hepatic (CLIN-CRCL-001 needs creatinine + weight + age; CLIN-BILI-001 bilirubin + AST)
  ('01','CREAT','lab','CREATININE',0.7,0.8,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('02','CREAT','lab','CREATININE',0.7,0.7,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('03','CREAT','lab','CREATININE',11, 0.9,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('04','CREAT','lab','CREATININE',0.7,0.7,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('05','CREAT','lab','CREATININE',0.7,0.8,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('06','CREAT','lab','CREATININE',0.7,0.6,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('07','CREAT','lab','CREATININE',0.7,0.9,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('08','CREAT','lab','CREATININE',2,  0.7,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('09','CREAT','lab','CREATININE',0.7,0.9,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('10','CREAT','lab','CREATININE',0.7,0.7,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('11','CREAT','lab','CREATININE',0.7,1.0,NULL,'mg/dL','LOINC','2160-0','Creatinine',NULL),
  ('01','WT','vitals','WEIGHT',0.7,58,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('02','WT','vitals','WEIGHT',0.7,62,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('03','WT','vitals','WEIGHT',11, 64,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('04','WT','vitals','WEIGHT',0.7,55,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('05','WT','vitals','WEIGHT',0.7,60,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('06','WT','vitals','WEIGHT',0.7,54,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('07','WT','vitals','WEIGHT',0.7,59,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('08','WT','vitals','WEIGHT',2,  51,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('09','WT','vitals','WEIGHT',0.7,66,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('10','WT','vitals','WEIGHT',0.7,57,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('11','WT','vitals','WEIGHT',0.7,68,NULL,'kg','LOINC','29463-7','Body weight',NULL),
  ('01','BILI','lab','BILIRUBIN',0.7,0.6,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('02','BILI','lab','BILIRUBIN',0.7,0.5,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('03','BILI','lab','BILIRUBIN',11, 0.7,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('04','BILI','lab','BILIRUBIN',0.7,0.6,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('05','BILI','lab','BILIRUBIN',0.7,0.8,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('06','BILI','lab','BILIRUBIN',0.7,0.4,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('07','BILI','lab','BILIRUBIN',0.7,0.9,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('08','BILI','lab','BILIRUBIN',2,  0.5,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('09','BILI','lab','BILIRUBIN',0.7,0.8,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('10','BILI','lab','BILIRUBIN',0.7,0.5,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('11','BILI','lab','BILIRUBIN',0.7,0.7,NULL,'mg/dL','LOINC','1975-2','Bilirubin total',NULL),
  ('01','AST','lab','AST',0.7,26,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('02','AST','lab','AST',0.7,24,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('03','AST','lab','AST',11, 31,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('04','AST','lab','AST',0.7,29,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('05','AST','lab','AST',0.7,33,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('06','AST','lab','AST',0.7,21,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('07','AST','lab','AST',0.7,35,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('08','AST','lab','AST',2,  27,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('09','AST','lab','AST',0.7,30,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('10','AST','lab','AST',0.7,23,NULL,'U/L','LOINC','1920-8','AST',NULL),
  ('11','AST','lab','AST',0.7,28,NULL,'U/L','LOINC','1920-8','AST',NULL),
  -- HbA1c (ENDO-HBA1C-001, advisory). DC-09 is above 8.5.
  ('01','A1C','lab','HBA1C',20,5.6,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('02','A1C','lab','HBA1C',40,5.9,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('03','A1C','lab','HBA1C',30,6.1,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('04','A1C','lab','HBA1C',25,5.4,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('05','A1C','lab','HBA1C',35,6.4,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('06','A1C','lab','HBA1C',28,5.2,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('07','A1C','lab','HBA1C',45,7.1,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('08','A1C','lab','HBA1C',20,5.8,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('09','A1C','lab','HBA1C',14,9.4,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('10','A1C','lab','HBA1C',30,5.5,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  ('11','A1C','lab','HBA1C',50,6.8,NULL,'%','LOINC','4548-4','HbA1c',NULL),
  -- LVEF, trastuzumab patients only: baseline + current (SURV-LVEF-001/002).
  -- DC-02's current echo is 118 days old against the 90-day label interval.
  ('01','LVEF0','imaging','LVEF',112,64,NULL,'%','LOINC','10230-1','LVEF (echo)',NULL),
  ('01','LVEF1','imaging','LVEF',38, 61,NULL,'%','LOINC','10230-1','LVEF (echo)',NULL),
  ('02','LVEF0','imaging','LVEF',300,62,NULL,'%','LOINC','10230-1','LVEF (echo)',NULL),
  ('02','LVEF1','imaging','LVEF',118,58,NULL,'%','LOINC','10230-1','LVEF (echo)',NULL),
  ('06','LVEF0','imaging','LVEF',32, 66,NULL,'%','LOINC','10230-1','LVEF (echo)',NULL),
  ('06','LVEF1','imaging','LVEF',9,  65,NULL,'%','LOINC','10230-1','LVEF (echo)',NULL),
  -- DEXA T-score for breast patients (ENDO-DEXA-001, advisory)
  ('01','DEXA','imaging','T_SCORE',150,-0.8,NULL,NULL,'LOINC','38263-0','DEXA T-score',NULL),
  ('02','DEXA','imaging','T_SCORE',200,-1.4,NULL,NULL,'LOINC','38263-0','DEXA T-score',NULL),
  ('04','DEXA','imaging','T_SCORE',90, -0.5,NULL,NULL,'LOINC','38263-0','DEXA T-score',NULL),
  ('06','DEXA','imaging','T_SCORE',40, -0.3,NULL,NULL,'LOINC','38263-0','DEXA T-score',NULL),
  ('10','DEXA','imaging','T_SCORE',60, -1.1,NULL,NULL,'LOINC','38263-0','DEXA T-score',NULL),
  -- 24 Sept: evidence for the rules added from evidence/clinical/ (CLIN-PANEL-001,
  -- SAFE-HBV-001, SAFE-PREG-001). DC-03's labs share its 11-day-old draw; DC-08
  -- still has no CBC - both remain their designed blockers.
  ('01','HB','lab','HEMOGLOBIN',0.7,11.8,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('02','HB','lab','HEMOGLOBIN',0.7,12.4,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('03','HB','lab','HEMOGLOBIN',11,11.1,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('04','HB','lab','HEMOGLOBIN',0.7,10.6,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('05','HB','lab','HEMOGLOBIN',0.7,11.9,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('06','HB','lab','HEMOGLOBIN',0.7,12.1,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('07','HB','lab','HEMOGLOBIN',0.7,13.0,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('09','HB','lab','HEMOGLOBIN',0.7,12.6,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('10','HB','lab','HEMOGLOBIN',0.7,11.4,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('11','HB','lab','HEMOGLOBIN',0.7,12.9,NULL,'g/dL','LOINC','718-7','Haemoglobin',NULL),
  ('01','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('01','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('02','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('02','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('03','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('03','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('04','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('04','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('05','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('05','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('06','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('06','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('07','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('07','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('08','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('08','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('09','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('09','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('10','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('10','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('11','HBSAG','lab','HBSAG',100,NULL,'non-reactive',NULL,'LOINC','5196-1','HBsAg',NULL),
  ('11','ANTIHBC','lab','ANTI_HBC',100,NULL,'non-reactive',NULL,'LOINC','16933-4','Anti-HBc total',NULL),
  ('03','ALT','lab','ALT',11,34,NULL,'U/L','LOINC','1742-6','ALT',NULL),
  ('11','ALT','lab','ALT',0.7,29,NULL,'U/L','LOINC','1742-6','ALT',NULL),
  ('09','ALT','lab','ALT',0.7,31,NULL,'U/L','LOINC','1742-6','ALT',NULL),
  ('07','ALT','lab','ALT',0.7,38,NULL,'U/L','LOINC','1742-6','ALT',NULL),
  ('07','ALP','lab','ALP',0.7,96,NULL,'U/L','LOINC','6768-6','Alkaline phosphatase',NULL),
  ('07','LDH','lab','LDH',0.7,212,NULL,'U/L','LOINC','2532-0','LDH',NULL),
  ('05','NA','lab','SODIUM',0.7,137,NULL,'mmol/L','LOINC','2951-2','Sodium',NULL),
  ('05','K','lab','POTASSIUM',0.7,4.1,NULL,'mmol/L','LOINC','2823-3','Potassium',NULL),
  ('05','CA','lab','CALCIUM',0.7,9.2,NULL,'mg/dL','LOINC','17861-6','Calcium',NULL),
  ('05','ALB','lab','ALBUMIN',0.7,3.8,NULL,'g/dL','LOINC','1751-7','Albumin',NULL),
  ('05','MG','lab','MAGNESIUM',0.7,1.9,NULL,'mg/dL','LOINC','19123-9','Magnesium',NULL),
  ('02','HCG','lab','BETA_HCG',305,NULL,'negative',NULL,'LOINC','2106-3','Urine pregnancy test',NULL),
  ('06','HCG','lab','BETA_HCG',36,NULL,'negative',NULL,'LOINC','2106-3','Urine pregnancy test',NULL);

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (
  SELECT 'EVT-DC-' || e.k || '-' || e.sfx AS event_id,
         'PAT-DC-' || e.k AS patient_id,
         'ENC-DC-' || e.k AS encounter_id,
         e.event_type,
         o.concept_id,
         e.code_system, e.code, e.display, e.value_num, e.value_text, e.unit, e.specimen,
         DATEADD(minute, -ROUND(e.days_before * 1440), $dc_anchor)::TIMESTAMP_NTZ AS event_time
    FROM SAARTHI.OPERATIONAL._DC_EVENTS e
    LEFT JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY o ON o.canonical_name = e.concept
) s ON t.event_id = s.event_id
WHEN MATCHED THEN UPDATE SET
  t.concept_id = s.concept_id, t.event_time = s.event_time,
  t.source_recorded_at = DATEADD(hour, 3, s.event_time)
WHEN NOT MATCHED THEN INSERT (event_id, patient_id, encounter_id, event_type, concept_id, code_system, code,
  display, value_num, value_text, unit, original_value, original_unit, abnormal_flag, specimen_id,
  accession_id, status, negation, event_time, source_recorded_at, ingested_at, valid_until)
VALUES (s.event_id, s.patient_id, s.encounter_id, s.event_type, s.concept_id, s.code_system, s.code,
  s.display, s.value_num, s.value_text, s.unit, COALESCE(s.value_num::VARCHAR, s.value_text), s.unit, NULL,
  s.specimen, 'ACC-' || s.event_id, 'final', FALSE, s.event_time, DATEADD(hour, 3, s.event_time),
  CURRENT_TIMESTAMP(), NULL);

-- ---- administrations (DOSE-ANTHRA-001, DOSE-HLOAD-001, SAFE-PEMVIT-001) --------------
-- value_num is the dose as given; unit says per what. Doxorubicin 60 mg/m2 per
-- AC cycle (BRAJAC), trastuzumab 3-weekly (BRAJTTW/BRAJTR), B12 every 9 weeks
-- and daily folic acid for pemetrexed (LUAVPP).
CREATE OR REPLACE TEMPORARY TABLE SAARTHI.OPERATIONAL._DC_MEDS AS
SELECT column1 AS k, column2 AS sfx, column3 AS concept, column4::FLOAT AS days_before,
       column5::FLOAT AS dose, column6 AS unit, column7 AS status, column8 AS code, column9 AS display
FROM VALUES
  ('04','DOXO1','DOXORUBICIN',42,60,'mg/m2','administered','3639','Doxorubicin IV push, AC cycle 1'),
  ('04','DOXO2','DOXORUBICIN',21,60,'mg/m2','administered','3639','Doxorubicin IV push, AC cycle 2'),
  ('10','DOXO1','DOXORUBICIN',21,60,'mg/m2','administered','3639','Doxorubicin IV push, AC cycle 1'),
  ('01','HER1','TRASTUZUMAB',21,6,'mg/kg','administered','224905','Trastuzumab IV, maintenance dose'),
  ('02','HER1','TRASTUZUMAB',21,6,'mg/kg','administered','224905','Trastuzumab IV, maintenance dose'),
  ('06','HER1','TRASTUZUMAB',7,8,'mg/kg','administered','224905','Trastuzumab IV, loading dose'),
  ('07','B12','VITAMIN_B12',40,1000,'mcg','administered','11248','Vitamin B12 IM (pemetrexed premedication)'),
  ('07','FOL','FOLIC_ACID',3,0.4,'mg','dispensed','4511','Folic acid 0.4 mg PO daily');

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (
  SELECT 'EVT-DC-' || m.k || '-' || m.sfx AS event_id, 'PAT-DC-' || m.k AS patient_id,
         o.concept_id, m.dose, m.unit, m.status, m.code, m.display,
         DATEADD(minute, -ROUND(m.days_before * 1440), $dc_anchor)::TIMESTAMP_NTZ AS event_time
    FROM SAARTHI.OPERATIONAL._DC_MEDS m
    JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY o ON o.canonical_name = m.concept
) s ON t.event_id = s.event_id
WHEN MATCHED THEN UPDATE SET t.concept_id = s.concept_id, t.event_time = s.event_time,
  t.source_recorded_at = DATEADD(hour, 1, s.event_time)
WHEN NOT MATCHED THEN INSERT (event_id, patient_id, encounter_id, event_type, concept_id, code_system, code,
  display, value_num, unit, original_value, original_unit, status, negation, event_time, source_recorded_at, ingested_at)
VALUES (s.event_id, s.patient_id, NULL, 'medication', s.concept_id, 'RxNorm', s.code,
  s.display, s.dose, s.unit, s.dose::VARCHAR, s.unit, s.status, FALSE, s.event_time,
  DATEADD(hour, 1, s.event_time), CURRENT_TIMESTAMP());

-- ---- documents: consent, order, last discharge plan, nursing assessment ----------------
-- DOC-CONSENT-001 (signed after the plan, day -110), DOC-ORDER-001 (signed the
-- day before the visit), DOC-DISCH-001 (previous cycle, one cycle interval back),
-- DOC-ALLERGY-001 (a verified assertion on the nursing assessment). Records
-- only: these documents carry no parsed pages.
MERGE INTO SAARTHI.DOCUMENTS.DOCUMENT t
USING (
  SELECT 'DOC-DC-' || c.k || '-' || d.kind AS doc_id, 'PAT-DC-' || c.k AS patient_id, d.doc_type,
         DATEADD(day, -IFF(d.kind = 'DISCH', r.cycle_days, d.days_before), $dc_anchor)::TIMESTAMP_NTZ AS effective_at,
         d.signed
    FROM SAARTHI.OPERATIONAL._DC_COHORT c
    JOIN SAARTHI.OPERATIONAL.REGIMEN_REGISTRY r ON r.regimen_code = c.regimen_code
    CROSS JOIN (SELECT column1 AS kind, column2 AS doc_type, column3::INT AS days_before, column4::BOOLEAN AS signed
                  FROM VALUES ('CONSENT','chemo_consent',100,TRUE), ('ORDER','chemo_order',1,TRUE),
                              ('DISCH','discharge_summary',0,TRUE), ('NURSE','nursing_assessment',1,FALSE)) d
) s ON t.doc_id = s.doc_id
WHEN MATCHED THEN UPDATE SET t.effective_at = s.effective_at, t.signed_at = IFF(s.signed, s.effective_at, NULL)
WHEN NOT MATCHED THEN INSERT (doc_id, patient_id, scope, doc_type, version, revision_type, signed_at,
  effective_at, ingested_at, source_facility_id, ingestion_method, status)
VALUES (s.doc_id, s.patient_id, 'patient', s.doc_type, 1, 'original', IFF(s.signed, s.effective_at, NULL),
  s.effective_at, CURRENT_TIMESTAMP(), 'FAC-02', 'digital_emr', 'active');

MERGE INTO SAARTHI.EVIDENCE.ASSERTION t
USING (
  SELECT 'ASS-DC-' || k || '-ALLERGY' AS assertion_id, 'DOC-DC-' || k || '-NURSE' AS doc_id,
         'PAT-DC-' || k AS subject,
         IFF(k = '07', 'sulfonamide - rash (2019)', 'no known drug allergy') AS value
    FROM SAARTHI.OPERATIONAL._DC_COHORT
) s ON t.assertion_id = s.assertion_id
WHEN NOT MATCHED THEN INSERT (assertion_id, doc_id, page_index, concept_id, subject, predicate, value, unit,
  negation, missingness_state, verification_status, pass1_value, pass2_value, extractor_version, char_start, char_end)
VALUES (s.assertion_id, s.doc_id, 0, NULL, s.subject, 'allergy_history', s.value, NULL,
  FALSE, 'present', 'verified', s.value, s.value, 'seed-v1', 0, 0);
