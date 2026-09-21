-- =============================================================================
-- STEP 6d - EVIDENCE tables (4)
-- =============================================================================
-- SPEC.md §2.6, §2.8. ASSERTION carries R3 (7-state missingness) and R7
-- (two-pass verification audit trail: pass1_value/pass2_value never collapse
-- into a single value on disagreement).
CREATE TABLE IF NOT EXISTS SAARTHI.EVIDENCE.ASSERTION (
    assertion_id          VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    doc_id                VARCHAR NOT NULL,
    page_index            INT,
    concept_id            VARCHAR,                  -- FK -> OPERATIONAL.CLINICAL_ONTOLOGY
    subject                VARCHAR,
    predicate             VARCHAR,
    value                 VARCHAR,
    unit                  VARCHAR,
    negation              BOOLEAN DEFAULT FALSE,
    missingness_state     VARCHAR CHECK (missingness_state IN
                              ('present','explicitly_negative','pending','not_received',
                               'conflicting','unreadable','superseded')),               -- R3
    fhir_absent_reason    VARCHAR,                  -- maps R3 -> FHIR dataAbsentReason
    extraction_confidence FLOAT,
    verification_status   VARCHAR CHECK (verification_status IN
                              ('verified','conflicting','unverified','single_pass')),   -- R7
    pass1_value           VARCHAR,                  -- R7 audit trail
    pass2_value           VARCHAR,
    extractor_version     VARCHAR,
    char_start            INT,
    char_end              INT
);

-- discordant_across_specimens (D3) - neither a match nor an error, a third
-- relation. Dipali's outside biopsy vs CMC surgical specimen: different
-- accession IDs, so specimen-keyed matching never collides, yet this is the
-- finding that changed her treatment.
CREATE TABLE IF NOT EXISTS SAARTHI.EVIDENCE.EVIDENCE_LINK (
    link_id       VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    assertion_id  VARCHAR NOT NULL,
    target_type   VARCHAR,
    target_id     VARCHAR,
    relation      VARCHAR CHECK (relation IN
                      ('supports','conflicts_with','supersedes','complemented_by','discordant_across_specimens'))
);

-- Stores POINTERS, never content. DPDP s.12(3) erasure and Rule 6(e) 1-year
-- retention are mutually unsatisfiable if answer text is stored inline.
CREATE TABLE IF NOT EXISTS SAARTHI.EVIDENCE.ANSWER_RUN (
    run_id             VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    question           VARCHAR,
    question_class     VARCHAR CHECK (question_class IN ('A','B')),
    practitioner_id    VARCHAR,
    patient_id         VARCHAR,
    consent_id         VARCHAR,
    known_as_of        TIMESTAMP_NTZ,
    answer_status      VARCHAR,
    claims_json        VARIANT,
    evidence_ids       ARRAY,                       -- POINTERS, not content
    model_version      VARCHAR,
    validation_results VARIANT,
    latency_ms         INT,
    created_at         TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
)
DATA_RETENTION_TIME_IN_DAYS = 90;  -- DPDP Rule 6(e) wants >=1yr; 90 is this trial account's hard cap. Documented gap, not silently dropped.

-- Every Class A refusal promises to route evidence "to the treating team" -
-- this packet is the actual output of the most safety-critical path (D8).
CREATE TABLE IF NOT EXISTS SAARTHI.EVIDENCE.EVIDENCE_PACKET (
    packet_id                    VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id                   VARCHAR NOT NULL,
    question                     VARCHAR,
    created_by_practitioner_id   VARCHAR,
    evidence_ids                 ARRAY,
    gate_snapshot                VARIANT,
    consent_id                   VARCHAR,
    delivered_to_practitioner_id VARCHAR,
    delivered_at                 TIMESTAMP_NTZ
);
