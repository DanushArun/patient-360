-- =============================================================================
-- STEP 6 (extension) - PRE_AUTHORIZATION table
-- =============================================================================
-- Added post-hoc: COV-AUTH-001 rule requires a pre-authorisation status feed
-- to evaluate approved/denied/pending. Not in the original SPEC.md table
-- inventory but named by COV-AUTH-001's threshold_json ('required_status',
-- 'conflicting_if'). Structure mirrors PM-JAY / state-scheme pre-auth message
-- flow: a request + response pair per package for a patient encounter.
--
-- Idempotency: CREATE IF NOT EXISTS + MERGE seeds.

CREATE TABLE IF NOT EXISTS SAARTHI.CORE.PRE_AUTHORIZATION (
    pre_auth_id             VARCHAR PRIMARY KEY,
    patient_id              VARCHAR NOT NULL,
    encounter_id            VARCHAR,
    coverage_id             VARCHAR,
    scheme                  VARCHAR,                                    -- 'PM-JAY' | 'state' | 'private'
    package_code            VARCHAR,                                    -- scheme's package identifier
    package_display         VARCHAR,
    status                  VARCHAR NOT NULL,                           -- 'approved' | 'denied' | 'pending' | 'expired'
    letter_status           VARCHAR,                                    -- status as printed on the physical letter (may drift from table)
    reason                  VARCHAR,                                    -- populated when denied
    requested_at            TIMESTAMP_NTZ,
    decided_at              TIMESTAMP_NTZ,
    expires_at              TIMESTAMP_NTZ,
    reviewed_by             VARCHAR,
    ingested_at             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pa_status_ck  CHECK (status IN ('approved','denied','pending','expired')),
    CONSTRAINT pa_scheme_ck  CHECK (scheme IN ('PM-JAY','state','private'))
);
