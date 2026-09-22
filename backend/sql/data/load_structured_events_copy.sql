-- COPY INTO per facility - each facility's CSV is its own source system, and
-- carries no facility identifier of its own (SPEC.md: real EHRs are siloed),
-- so facility_id is supplied here as a literal per file, not read from the CSV.
--
-- IDEMPOTENCY - truncate staging first so a re-run does not append duplicates.
-- Safe because no stream reads STG_SOURCE_EVENTS (verified against SHOW STREAMS
-- on 22 Sept - only DOC_STREAM exists, over @PATIENT_DOCS). transform_structured_events.sql
-- MERGEs into ENCOUNTER + CLINICAL_EVENT downstream, so repeated STG->transform
-- runs are idempotent end-to-end.
TRUNCATE TABLE SAARTHI.CORE.STG_SOURCE_EVENTS;

COPY INTO SAARTHI.CORE.STG_SOURCE_EVENTS
  (facility_id, local_patient_id, event_id, kind, event_time, source_recorded_at,
   specimen_id, specimen_source, grade, ihc_score, t_score, wbc_per_uL, neutrophil_pct, platelet_count)
FROM (
  SELECT 'FAC-01', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  FROM @SAARTHI.CORE.%STG_SOURCE_EVENTS/FAC-01/
)
FILE_FORMAT = SAARTHI.CORE.CSV_SOURCE_EVENTS
ON_ERROR = ABORT_STATEMENT;

COPY INTO SAARTHI.CORE.STG_SOURCE_EVENTS
  (facility_id, local_patient_id, event_id, kind, event_time, source_recorded_at,
   specimen_id, specimen_source, grade, ihc_score, t_score, wbc_per_uL, neutrophil_pct, platelet_count)
FROM (
  SELECT 'FAC-02', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  FROM @SAARTHI.CORE.%STG_SOURCE_EVENTS/FAC-02/
)
FILE_FORMAT = SAARTHI.CORE.CSV_SOURCE_EVENTS
ON_ERROR = ABORT_STATEMENT;

COPY INTO SAARTHI.CORE.STG_SOURCE_EVENTS
  (facility_id, local_patient_id, event_id, kind, event_time, source_recorded_at,
   specimen_id, specimen_source, grade, ihc_score, t_score, wbc_per_uL, neutrophil_pct, platelet_count)
FROM (
  SELECT 'FAC-03', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  FROM @SAARTHI.CORE.%STG_SOURCE_EVENTS/FAC-03/
)
FILE_FORMAT = SAARTHI.CORE.CSV_SOURCE_EVENTS
ON_ERROR = ABORT_STATEMENT;

COPY INTO SAARTHI.CORE.STG_SOURCE_EVENTS
  (facility_id, local_patient_id, event_id, kind, event_time, source_recorded_at,
   specimen_id, specimen_source, grade, ihc_score, t_score, wbc_per_uL, neutrophil_pct, platelet_count)
FROM (
  SELECT 'FAC-04', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  FROM @SAARTHI.CORE.%STG_SOURCE_EVENTS/FAC-04/
)
FILE_FORMAT = SAARTHI.CORE.CSV_SOURCE_EVENTS
ON_ERROR = ABORT_STATEMENT;
