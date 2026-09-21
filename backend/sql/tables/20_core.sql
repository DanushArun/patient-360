-- =============================================================================
-- STEP 6b - CORE tables (8)
-- =============================================================================
-- SPEC.md §2.3, §2.4, §2.5. No policies attached yet (step 7/8).
-- Drop the v1-shaped legacy tables first - archived in planning/archive/v1-src-sql/,
-- predate the revised architecture (6 schemas, no GOVERNANCE tables, facility
-- as bare VARCHAR). IF NOT EXISTS cannot fix a table with the wrong columns.
DROP TABLE IF EXISTS SAARTHI.CORE.PATIENT;
DROP TABLE IF EXISTS SAARTHI.CORE.ID_MAP;
DROP TABLE IF EXISTS SAARTHI.CORE.ENCOUNTER;
DROP TABLE IF EXISTS SAARTHI.CORE.COVERAGE;

CREATE TABLE IF NOT EXISTS SAARTHI.CORE.PATIENT (
    patient_id       VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    abha_ref         VARCHAR,                       -- nullable - most Indian patients have none (R4)
    name             VARCHAR     NOT NULL,
    dob              DATE,
    gender           VARCHAR,
    district         VARCHAR,
    state            VARCHAR,
    primary_language VARCHAR,
    created_at       TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS SAARTHI.CORE.ID_MAP (
    map_id            VARCHAR   DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id        VARCHAR   NOT NULL,
    source_system     VARCHAR   NOT NULL,
    source_patient_id VARCHAR   NOT NULL,
    link_status       VARCHAR   NOT NULL CHECK (link_status IN ('abha_linked','manually_verified','quarantined')),
    link_evidence     VARCHAR,
    linked_at         TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    UNIQUE (source_system, source_patient_id)
);

-- The bring-list = documents_expected minus documents_received. Central moment:
-- 74% of patients cross >=2 facilities, 82.6% hit a delay (RWR).
CREATE TABLE IF NOT EXISTS SAARTHI.CORE.REFERRAL (
    referral_id               VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id                VARCHAR NOT NULL,
    from_facility_id          VARCHAR,
    to_facility_id            VARCHAR,
    referring_practitioner_id VARCHAR,
    reason                    VARCHAR,
    referral_date             DATE,
    consent_id                VARCHAR,
    documents_expected        ARRAY,
    documents_received        ARRAY,
    status                    VARCHAR CHECK (status IN ('open','partial','complete'))
);

CREATE TABLE IF NOT EXISTS SAARTHI.CORE.ENCOUNTER (
    encounter_id    VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id      VARCHAR     NOT NULL,
    facility_id     VARCHAR     NOT NULL,
    department_id   VARCHAR,
    encounter_type  VARCHAR     NOT NULL CHECK (encounter_type IN ('opd','daycare','inpatient','imaging','lab_visit')),
    scheduled_time  TIMESTAMP_NTZ,                  -- NULL when no FHIR Appointment exists - never default to event_time
    event_time      TIMESTAMP_NTZ,                  -- R2
    cycle_number    INT,
    status          VARCHAR,
    delay_reason    VARCHAR,
    gap_type        VARCHAR     CHECK (gap_type IN ('documentation','clinical_complication','financial','logistics','none')),
    version         INT         NOT NULL DEFAULT 1, -- optimistic locking
    ingested_at     TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS SAARTHI.CORE.CLINICAL_EVENT (
    event_id           VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id         VARCHAR     NOT NULL,
    encounter_id       VARCHAR,
    event_type         VARCHAR     NOT NULL CHECK (event_type IN
                            ('lab','vitals','diagnosis','staging','imaging','medication','pathology','treatment_plan_change')),
    concept_id         VARCHAR,                     -- FK -> OPERATIONAL.CLINICAL_ONTOLOGY
    code_system        VARCHAR,
    code               VARCHAR,
    display            VARCHAR,
    value_text         VARCHAR,
    value_num          FLOAT,
    unit               VARCHAR,
    original_value     VARCHAR,                     -- source text preserved, pre-normalisation
    original_unit      VARCHAR,
    abnormal_flag      VARCHAR,                      -- the L/H suffix - NEVER folded into value_num
    specimen_id        VARCHAR,
    accession_id       VARCHAR,
    status             VARCHAR     CHECK (status IN
                            ('preliminary','final','amended','cancelled','ordered','administered','dispensed')),
    negation           BOOLEAN     DEFAULT FALSE,
    event_time         TIMESTAMP_NTZ,                -- R2 clock 1
    source_recorded_at TIMESTAMP_NTZ,                -- R2 clock 2
    ingested_at        TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(), -- R2 clock 3
    valid_until        TIMESTAMP_NTZ                 -- D6 validity interval (labs 72h, LVEF 90d, etc.)
);

-- Dipali's real plan changed 4 times in 18 months (RWR).
CREATE TABLE IF NOT EXISTS SAARTHI.CORE.TREATMENT_PLAN (
    plan_id                    VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id                 VARCHAR NOT NULL,
    version                    INT     NOT NULL DEFAULT 1,
    regimen_code               VARCHAR,
    regimen_display            VARCHAR,
    intent                     VARCHAR CHECK (intent IN ('curative','palliative','adjuvant','neoadjuvant')),
    planned_cycles             INT,
    decided_at                 TIMESTAMP_NTZ,
    decided_by_practitioner_id VARCHAR,
    decision_forum             VARCHAR CHECK (decision_forum IN ('tumour_board','opd','mdt')),
    supersedes_plan_id         VARCHAR,
    reason_for_change          VARCHAR
);

-- is_family_floater is a FLAG, not an arithmetic input. annual_limit/used_amount
-- are patient-level only - PM-JAY's true per-family remaining balance is
-- declared unknown, never estimated (R3 applied to coverage).
CREATE TABLE IF NOT EXISTS SAARTHI.CORE.COVERAGE (
    coverage_id       VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id        VARCHAR NOT NULL,
    payer_type        VARCHAR NOT NULL CHECK (payer_type IN ('scheme','private_insurance','self_pay')),
    payer_name        VARCHAR,
    policy_number     VARCHAR,
    is_family_floater BOOLEAN DEFAULT FALSE,
    effective_from    DATE,
    effective_to      DATE,
    annual_limit      FLOAT,
    used_amount       FLOAT,
    priority          INT,                          -- primary vs secondary payer
    portability       VARCHAR CHECK (portability IN ('cross_state','within_state','none'))
);

-- status gains 'partial' and 'conflicting' - the flagship demo scenario
-- (table says pending, letter says approved) needs 'conflicting' to exist.
CREATE TABLE IF NOT EXISTS SAARTHI.CORE.AUTHORIZATION (
    auth_id           VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    coverage_id       VARCHAR NOT NULL,
    encounter_id      VARCHAR,
    package_code      VARCHAR,
    requested_amount  FLOAT,
    approved_amount   FLOAT,
    status            VARCHAR CHECK (status IN ('pending','approved','denied','partial','expired','conflicting')),
    denial_reason     VARCHAR,
    denial_is_curable BOOLEAN,                       -- 60-70% of denials are procedurally curable (RWR)
    requested_at      TIMESTAMP_NTZ,
    responded_at      TIMESTAMP_NTZ,
    valid_until       TIMESTAMP_NTZ
);
