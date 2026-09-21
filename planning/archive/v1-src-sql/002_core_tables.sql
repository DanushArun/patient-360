-- ============================================================
-- SAARTHI — CORE schema tables
-- PATIENT, ID_MAP, ENCOUNTER, CLINICAL_EVENT, COVERAGE, AUTHORIZATION
-- ============================================================
USE DATABASE SAARTHI;
USE SCHEMA CORE;

-- 1. PATIENT — canonical patient identity
CREATE TABLE IF NOT EXISTS PATIENT (
  patient_id       VARCHAR(20)   NOT NULL PRIMARY KEY,
  tenant_id        VARCHAR(50)   NOT NULL DEFAULT 'SAARTHI-DEMO',
  abha_ref         VARCHAR(20),                              -- 14-digit ABHA, nullable (R4: most Indian patients have no ABHA)
  name             VARCHAR(200)  NOT NULL,
  dob              DATE          NOT NULL,
  gender           VARCHAR(10)   NOT NULL,                   -- M, F, Other
  district         VARCHAR(100),
  state            VARCHAR(100),
  primary_language VARCHAR(20)   DEFAULT 'Hindi',            -- for Cortex TRANSLATE on bring-list
  created_at       TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'One row per patient. Canonical identity anchor — R4 ABHA-linked but ABHA is optional.';

-- 2. ID_MAP — cross-facility identity resolution
CREATE TABLE IF NOT EXISTS ID_MAP (
  map_id             VARCHAR(30)   NOT NULL PRIMARY KEY,
  patient_id         VARCHAR(20)   NOT NULL REFERENCES PATIENT(patient_id),
  source_system      VARCHAR(100)  NOT NULL,                 -- e.g. SPOKE_DIST_HOSP_JHANSI, HUB_CANCER_DELHI
  source_patient_id  VARCHAR(100)  NOT NULL,                 -- MRN, beneficiary ID, lab patient ID
  link_status        VARCHAR(30)   NOT NULL DEFAULT 'quarantined',  -- abha_linked | manually_verified | quarantined
  link_evidence      VARCHAR(500),                           -- free text: how was this linked
  linked_at          TIMESTAMP_NTZ,
  CONSTRAINT uq_source UNIQUE (source_system, source_patient_id)
)
COMMENT = 'Maps external IDs to canonical patient_id. Quarantined records contribute NO evidence to answers.';

-- 3. ENCOUNTER — every visit, admission, or interaction
CREATE TABLE IF NOT EXISTS ENCOUNTER (
  encounter_id   VARCHAR(30)   NOT NULL PRIMARY KEY,
  patient_id     VARCHAR(20)   NOT NULL REFERENCES PATIENT(patient_id),
  facility       VARCHAR(100)  NOT NULL,                     -- SPOKE, HUB, EXT_LAB, etc.
  encounter_type VARCHAR(30)   NOT NULL,                     -- opd | daycare | inpatient | imaging | lab_visit
  scheduled_time TIMESTAMP_NTZ,                              -- R2: when it was supposed to happen
  event_time     TIMESTAMP_NTZ,                              -- R2: when it actually happened (NULL if not yet)
  cycle_number   INT,                                        -- chemo cycle number, NULL for non-chemo visits
  status         VARCHAR(20)   NOT NULL DEFAULT 'scheduled', -- scheduled | completed | delayed | cancelled
  delay_reason   VARCHAR(500),                               -- free text explanation if delayed/cancelled
  gap_type       VARCHAR(30)   DEFAULT 'none',               -- documentation | clinical_complication | financial | logistics | none
  ingested_at    TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'One row per visit. scheduled_time ≠ event_time reveals delays (R2 three clocks). gap_type from Dipali study.';

-- 4. CLINICAL_EVENT — lab results, diagnoses, imaging, medications, pathology
CREATE TABLE IF NOT EXISTS CLINICAL_EVENT (
  event_id           VARCHAR(30)    NOT NULL PRIMARY KEY,
  patient_id         VARCHAR(20)    NOT NULL REFERENCES PATIENT(patient_id),
  encounter_id       VARCHAR(30)    REFERENCES ENCOUNTER(encounter_id),
  event_type         VARCHAR(30)    NOT NULL,                -- lab | diagnosis | staging | imaging | medication | pathology
  code_system        VARCHAR(30),                            -- LOINC, ICD-10, SNOMED, AJCC, local
  code               VARCHAR(30),                            -- LOINC code, ICD code, drug code
  display            VARCHAR(200)   NOT NULL,                -- human-readable name
  value_text         VARCHAR(500),                           -- text value (e.g. "BIRADS 5, 2.5cm mass")
  value_num          FLOAT,                                  -- numeric value (e.g. 6800 for WBC)
  unit               VARCHAR(30),                            -- normalized unit (cells/uL, g/dL, mg, etc.)
  original_value     VARCHAR(200),                           -- original value as written in source (e.g. "1.9 lakhs")
  original_unit      VARCHAR(50),                            -- original unit from source report
  specimen_id        VARCHAR(50),                            -- links lab results to same blood draw
  accession_id       VARCHAR(50),                            -- links pathology to same specimen
  status             VARCHAR(20)    NOT NULL DEFAULT 'final',-- preliminary | final | amended | cancelled
  negation           BOOLEAN        DEFAULT FALSE,           -- true if "no evidence of X"
  event_time         TIMESTAMP_NTZ  NOT NULL,                -- R2 clock 1: when event occurred
  source_recorded_at TIMESTAMP_NTZ,                          -- R2 clock 2: when source system recorded it
  ingested_at        TIMESTAMP_NTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP() -- R2 clock 3: when we got it
)
COMMENT = 'Every clinical observation. Three timestamps (R2). original_value preserves source text before normalization.';

-- 5. COVERAGE — insurance/scheme enrollment
CREATE TABLE IF NOT EXISTS COVERAGE (
  coverage_id    VARCHAR(30)    NOT NULL PRIMARY KEY,
  patient_id     VARCHAR(20)    NOT NULL REFERENCES PATIENT(patient_id),
  payer_type     VARCHAR(30)    NOT NULL,                    -- scheme | private_insurance | self_pay
  payer_name     VARCHAR(100)   NOT NULL,                    -- PM-JAY, Star Health, etc.
  policy_number  VARCHAR(100),
  effective_from DATE           NOT NULL,
  effective_to   DATE,
  annual_limit   NUMBER(12,2),                               -- in INR
  used_amount    NUMBER(12,2)   DEFAULT 0,
  portability    VARCHAR(30),                                -- cross_state | within_state | none
  ingested_at    TIMESTAMP_NTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Coverage policies per patient. PM-JAY portability and annual limits tracked.';

-- 6. AUTHORIZATION — pre-auth requests and approvals
CREATE TABLE IF NOT EXISTS AUTHORIZATION (
  auth_id          VARCHAR(30)    NOT NULL PRIMARY KEY,
  coverage_id      VARCHAR(30)    NOT NULL REFERENCES COVERAGE(coverage_id),
  encounter_id     VARCHAR(30)    REFERENCES ENCOUNTER(encounter_id),
  package_code     VARCHAR(50),                              -- PM-JAY package code or insurer procedure code
  requested_amount NUMBER(12,2),
  approved_amount  NUMBER(12,2),                             -- NULL = not yet responded
  status           VARCHAR(20)    NOT NULL DEFAULT 'pending',-- pending | approved | denied | expired
  denial_reason    VARCHAR(500),                             -- populated if denied
  requested_at     TIMESTAMP_NTZ  NOT NULL,
  responded_at     TIMESTAMP_NTZ,
  valid_until      DATE,                                     -- authorization expiry
  portability      VARCHAR(30),                              -- cross_state | within_state
  ingested_at      TIMESTAMP_NTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Pre-authorization lifecycle. Pending auth is the #1 demo scenario for coverage gate.';
