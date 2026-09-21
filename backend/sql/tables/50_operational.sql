-- =============================================================================
-- STEP 6e - OPERATIONAL tables (10)
-- =============================================================================
-- SPEC.md §2.7, §2.8. Ontology named twice in the CoCo guidelines (G5) -
-- CLINICAL_ONTOLOGY + UNIT_REGISTRY close that gap and prevent a real
-- patient-safety bug: creatinine mg/dL vs µmol/L differs 88.4x, and CrCl is
-- inversely proportional to it.
CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY (
    concept_id             VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    concept_type           VARCHAR CHECK (concept_type IN
                                ('analyte','biomarker','procedure','diagnosis','medication','document_type')),
    canonical_name         VARCHAR NOT NULL,
    code_system            VARCHAR,
    code                   VARCHAR,
    specialty              VARCHAR,
    synonyms               ARRAY,                   -- SGOT->AST, PLT/thrombocytes, etc.
    is_safety_critical     BOOLEAN DEFAULT FALSE,    -- drives R7 two-pass
    reflexes_to_concept_id VARCHAR                   -- IHC 2+ -> FISH
);

CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.UNIT_REGISTRY (
    registry_id         VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    concept_id          VARCHAR NOT NULL,
    canonical_unit      VARCHAR,
    source_unit_pattern VARCHAR,                     -- 'GM%', '/CUMM', 'mg%'
    conversion_factor   FLOAT,
    plausible_min       FLOAT,
    plausible_max       FLOAT,                       -- outside range -> rejected as unreadable, never stored
    notes               VARCHAR
);

-- NOTE: SPEC.md §2.8's own ASCII column list for this table omits
-- provenance_note, but ARCHITECTURE-HANDOFF.md Contract 4, WORK-PLAN.md, and
-- ARCHITECTURE-DIAGRAMS.md build-order step 11 all require it as mandatory
-- ("a scoring decision" - where a threshold is practice consensus rather than
-- a guideline requirement, it must say so). Treated as a documentation gap in
-- SPEC.md, not a deliberate omission, and fixed here rather than worked around.
CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.RULE_CATALOG (
    rule_id         VARCHAR NOT NULL,
    rule_version    INT     NOT NULL,
    gate            VARCHAR CHECK (gate IN ('clinical','safety','documentation','coverage','identity')),
    specialty       VARCHAR,
    disease_scope   VARCHAR,
    specificity     INT,                             -- resolves precedence (D5)
    display_name    VARCHAR,
    description     VARCHAR,
    threshold_json  VARIANT,
    guideline_ref   VARCHAR,
    provenance_note VARCHAR,                         -- mandatory per ARCHITECTURE-HANDOFF.md Contract 4
    applies_to      VARCHAR,
    severity        VARCHAR CHECK (severity IN ('blocker','advisory')),
    effective_from  TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    effective_to    TIMESTAMP_NTZ,
    PRIMARY KEY (rule_id, rule_version)
);

CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.REVIEW_ISSUE (
    issue_id      VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    rule_id       VARCHAR,
    rule_version  INT,
    patient_id    VARCHAR NOT NULL,
    encounter_id  VARCHAR,
    gate          VARCHAR,
    state         VARCHAR CHECK (state IN ('open','evidence_received','closed','escalated')),
    outcome       VARCHAR CHECK (outcome IN ('pass','fail','not_evaluated','conflicting')),
    reason        VARCHAR,
    evidence_ids  ARRAY,
    severity      VARCHAR,
    days_to_visit INT,
    version       INT     NOT NULL DEFAULT 1,        -- S4 optimistic locking
    created_at    TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

-- Named REVIEW_TASK, not TASK - a table called TASK collides confusingly with
-- Snowflake TASK objects.
CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.REVIEW_TASK (
    task_id             VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    issue_id            VARCHAR NOT NULL,
    owner_practitioner_id VARCHAR,
    state               VARCHAR,
    decision            VARCHAR,
    reason              VARCHAR,
    actor_practitioner_id VARCHAR,
    idempotency_key     VARCHAR NOT NULL UNIQUE,
    created_at          TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

-- Materialised by TASK_REFRESH_READINESS calling evaluate_gates. Read by
-- get_readiness. not_evaluated is not fail - R3 applied at the gate layer.
CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.READINESS_STATE (
    patient_id   VARCHAR NOT NULL,
    encounter_id VARCHAR NOT NULL,
    gate         VARCHAR NOT NULL,
    rule_id      VARCHAR NOT NULL,
    rule_version INT,
    outcome      VARCHAR CHECK (outcome IN ('pass','fail','not_evaluated','conflicting')),
    severity     VARCHAR,
    reason       VARCHAR,
    evidence_ids ARRAY,
    known_as_of  TIMESTAMP_NTZ,
    computed_at  TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (patient_id, encounter_id, gate, rule_id)
);

CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.NOTIFICATION (
    notification_id  VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    issue_id         VARCHAR,
    channel          VARCHAR CHECK (channel IN ('email','slack')),
    recipient        VARCHAR,
    sent_at          TIMESTAMP_NTZ,
    escalation_level INT
);

CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.SOURCE_SYSTEM (
    source_id        VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    facility_id      VARCHAR,
    system_name      VARCHAR,
    ingestion_method VARCHAR,
    fhir_capable     BOOLEAN DEFAULT FALSE,
    endpoint_ref     VARCHAR
);

CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.INGESTION_RUN (
    run_id           VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    source_id        VARCHAR,
    started_at       TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    completed_at     TIMESTAMP_NTZ,
    records_received INT,
    records_loaded   INT,
    records_failed   INT,
    error_detail     VARCHAR,
    file_hashes      ARRAY
);

CREATE TABLE IF NOT EXISTS SAARTHI.OPERATIONAL.SCHEME_REGISTRY (
    scheme_id        VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    scheme_name      VARCHAR,
    scheme_type      VARCHAR,
    eligibility_json VARIANT,
    covered_packages ARRAY,
    annual_limit     FLOAT,
    state_scope      VARCHAR
);
