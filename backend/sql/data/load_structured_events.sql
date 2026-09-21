-- =============================================================================
-- STEP 12b - Structured event ingestion (CSV per source system -> staging)
-- =============================================================================
-- SPEC.md §3: "Structured | CSV per source system | COPY INTO -> staging -> DT".
-- Staging table matches data/generator/projections.py's exact CSV shape
-- (local_patient_id keyed per facility - real hospital EHRs do not share a
-- patient key; ID_MAP resolves it, not this table). Uses the table's own
-- implicit stage (@%), not one of the three named stages in the object
-- inventory (PATIENT_DOCS/REFERENCE_DOCS/SKILLS) - those are reserved for the
-- AI-function-readable document paths (SNOWFLAKE_SSE), and the inventory must
-- stay at exactly three.
CREATE TABLE IF NOT EXISTS SAARTHI.CORE.STG_SOURCE_EVENTS (
    facility_id        VARCHAR,
    local_patient_id   VARCHAR,
    event_id           VARCHAR,
    kind               VARCHAR,
    event_time         TIMESTAMP_NTZ,
    source_recorded_at TIMESTAMP_NTZ,
    specimen_id        VARCHAR,
    specimen_source    VARCHAR,
    grade              VARCHAR,
    ihc_score          VARCHAR,
    t_score            FLOAT,
    wbc_per_uL         FLOAT,
    neutrophil_pct     FLOAT,
    platelet_count     FLOAT
);

CREATE FILE FORMAT IF NOT EXISTS SAARTHI.CORE.CSV_SOURCE_EVENTS
  TYPE = CSV FIELD_DELIMITER = ',' SKIP_HEADER = 1
  FIELD_OPTIONALLY_ENCLOSED_BY = '"' NULL_IF = ('') EMPTY_FIELD_AS_NULL = TRUE;
