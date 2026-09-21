-- =============================================================================
-- STEP 6a - GOVERNANCE tables (8)
-- =============================================================================
-- SPEC.md §2.1, §2.2. ORGANIZATION..CARE_TEAM answer "may this user see patient
-- X" (R5). PATIENT_BINDING answers "which patient is this question about"
-- (COPILOT-SPEC.md §0 - a fatal gap in v1: a permitted set is not a subject).
-- No FOREIGN KEY constraints: Snowflake does not enforce them (NOT ENFORCED
-- even when declared), and CARE_TEAM/CONSENT reference CORE.PATIENT, which is
-- created after this file in the build order. Real enforcement is the row
-- access policy (step 7) and the procedures (step 14), not a DDL constraint.
--
-- Clean out ad-hoc verification-only objects from the F3/F7 platform probes
-- (evidence/coco/verification-query-ids.md). CARE_TEAM replaces ROLE_PATIENT_MAP.
DROP TABLE IF EXISTS SAARTHI.GOVERNANCE.ROLE_PATIENT_MAP;
DROP TABLE IF EXISTS SAARTHI.GOVERNANCE.R5_TEST_CHUNK;
DROP TABLE IF EXISTS SAARTHI.GOVERNANCE.R5_TEST_EVIDENCE;

CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.ORGANIZATION (
    org_id          VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    name            VARCHAR     NOT NULL,
    type            VARCHAR     NOT NULL CHECK (type IN ('hospital_network','lab','payer','scheme')),
    state           VARCHAR,
    created_at      TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.FACILITY (
    facility_id     VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    org_id          VARCHAR     NOT NULL,
    name            VARCHAR     NOT NULL,
    hfr_id          VARCHAR,                       -- Health Facility Registry ID (ABDM)
    facility_type   VARCHAR     NOT NULL CHECK (facility_type IN ('hub','spoke','lab','imaging','pharmacy')),
    district        VARCHAR,
    state           VARCHAR,
    created_at      TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.DEPARTMENT (
    department_id   VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    facility_id     VARCHAR     NOT NULL,
    specialty       VARCHAR     NOT NULL CHECK (specialty IN
                        ('medical_oncology','cardiology','nephrology','hepatology',
                         'endocrinology','general_surgery','radiation_oncology','pathology')),
    name            VARCHAR     NOT NULL
);

CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.PRACTITIONER (
    practitioner_id     VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    facility_id         VARCHAR     NOT NULL,
    department_id       VARCHAR,
    name                VARCHAR     NOT NULL,
    nmc_registration_no VARCHAR,                   -- NMC accountability; adverse inference from gaps (law-medical-records.md)
    qualification       VARCHAR,
    snowflake_user      VARCHAR     NOT NULL,       -- CURRENT_USER() -> PRACTITIONER -> CARE_TEAM (F3)
    active              BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.CARE_TEAM (
    care_team_id    VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    practitioner_id VARCHAR     NOT NULL,
    patient_id      VARCHAR     NOT NULL,
    facility_id     VARCHAR     NOT NULL,
    role_type       VARCHAR     NOT NULL CHECK (role_type IN ('treating','coordinator','consulting','patient_navigator')),
    active_from     TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    active_to       TIMESTAMP_NTZ,                  -- NULL = still active
    granted_by      VARCHAR,
    created_at      TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    UNIQUE (practitioner_id, patient_id, facility_id, role_type)
);

CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.CONSENT (
    consent_id              VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id              VARCHAR     NOT NULL,
    granted_to_facility_id  VARCHAR,
    granted_to_org_id       VARCHAR,                -- either facility or org scope
    granted_by              VARCHAR     NOT NULL CHECK (granted_by IN ('patient','guardian')),
    grantor_name            VARCHAR,
    purpose_code            VARCHAR     NOT NULL CHECK (purpose_code IN ('treatment','coordination','claim','second_opinion')),
    data_categories         ARRAY,                  -- clinical|financial|identity
    date_range_from         DATE,
    date_range_to           DATE,
    valid_from              TIMESTAMP_NTZ NOT NULL,
    valid_until             TIMESTAMP_NTZ,
    status                  VARCHAR     NOT NULL CHECK (status IN ('active','revoked','expired')),
    revoked_at              TIMESTAMP_NTZ,
    revocation_reason       VARCHAR,
    artifact_hash           VARCHAR,                -- signed consent document
    abdm_consent_ref        VARCHAR,                -- nullable; ABDM linkage, stubbed per SPEC.md §15
    created_at              TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

-- COPILOT-SPEC.md §0 - the binding record. One row per bind action, append-only.
-- Selection (which patient) is never inferred from question text or chosen by
-- the agent - it is a human click, recorded here, re-validated on every tool call.
CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.PATIENT_BINDING (
    binding_id      VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    session_id      VARCHAR     NOT NULL,           -- CURRENT_SESSION()
    snowflake_user  VARCHAR     NOT NULL,           -- CURRENT_USER() at bind time
    patient_id      VARCHAR     NOT NULL,
    care_team_id    VARCHAR     NOT NULL,           -- the relationship that authorised it
    consent_id      VARCHAR     NOT NULL,           -- the consent that authorised it
    bound_at        TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    released_at     TIMESTAMP_NTZ                   -- set when the user switches patient
);

-- DPDP Rule 6(e) - access-anomaly logs retained >= 1 year. Rule 7 - 72h breach
-- notification, no materiality threshold.
CREATE TABLE IF NOT EXISTS SAARTHI.GOVERNANCE.SECURITY_EVENT (
    event_id        VARCHAR     DEFAULT UUID_STRING() PRIMARY KEY,
    event_time      TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    practitioner_id VARCHAR,
    event_type      VARCHAR     NOT NULL CHECK (event_type IN
                        ('cross_scope_attempt','consent_violation','validator_strip','injection_detected')),
    detail          VARIANT,
    query_id        VARCHAR
)
DATA_RETENTION_TIME_IN_DAYS = 90;  -- DPDP Rule 6(e) wants >=1yr; 90 is this trial account's hard cap. Documented gap, not silently dropped.
