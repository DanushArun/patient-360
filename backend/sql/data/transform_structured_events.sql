-- =============================================================================
-- STEP 12c - Transform staged CSV rows into CORE.ENCOUNTER / CLINICAL_EVENT
-- =============================================================================
-- Resolves local_patient_id -> patient_id via ID_MAP (cross-facility identity
-- resolution is ID_MAP's job, never a shared key across source systems).
-- One ENCOUNTER per chemo cycle. CLINICAL_EVENT rows are one (concept, value)
-- pair each - the CBC lands as two rows (WBC, NEUTROPHIL_PCT) so
-- DT_HARMONIZED_EVENTS can derive ANC from both.

MERGE INTO SAARTHI.CORE.ENCOUNTER t
USING (
  SELECT s.event_id AS encounter_id, im.patient_id, s.facility_id, s.event_time,
         TRY_TO_NUMBER(SPLIT_PART(s.event_id, '-', 3)) AS cycle_number,
         CASE WHEN TRY_TO_NUMBER(SPLIT_PART(s.event_id, '-', 3)) = 4
              THEN 'clinical_complication' ELSE 'none' END AS gap_type
  FROM SAARTHI.CORE.STG_SOURCE_EVENTS s
  JOIN SAARTHI.CORE.ID_MAP im ON im.source_patient_id = s.local_patient_id
  WHERE s.kind = 'chemo_cycle'
) s
ON t.encounter_id = s.encounter_id
WHEN NOT MATCHED THEN
  INSERT (encounter_id, patient_id, facility_id, encounter_type, scheduled_time, event_time, cycle_number, status, gap_type)
  VALUES (s.encounter_id, s.patient_id, s.facility_id, 'daycare', s.event_time, s.event_time, s.cycle_number, 'completed', s.gap_type);

-- CBC lab -> three CLINICAL_EVENT rows (WBC, NEUTROPHIL_PCT, PLT), linked to
-- the nearest-preceding chemo encounter. QUALIFY + ROW_NUMBER, not a
-- correlated subquery in the SELECT list (Snowflake rejects that shape here).
CREATE OR REPLACE TEMPORARY TABLE SAARTHI.CORE._TMP_CBC_NEAREST_ENCOUNTER AS
SELECT s.event_id, im.patient_id, e.encounter_id,
       s.wbc_per_uL, s.neutrophil_pct, s.platelet_count, s.event_time, s.source_recorded_at
FROM SAARTHI.CORE.STG_SOURCE_EVENTS s
JOIN SAARTHI.CORE.ID_MAP im ON im.source_patient_id = s.local_patient_id
JOIN SAARTHI.CORE.ENCOUNTER e ON e.patient_id = im.patient_id AND e.event_time <= s.event_time
WHERE s.kind = 'cbc_lab'
QUALIFY ROW_NUMBER() OVER (PARTITION BY s.event_id ORDER BY e.event_time DESC) = 1;

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (SELECT event_id || '-WBC' AS event_id, patient_id, encounter_id, wbc_per_uL AS value_num, event_time, source_recorded_at
       FROM SAARTHI.CORE._TMP_CBC_NEAREST_ENCOUNTER) s
ON t.event_id = s.event_id
WHEN NOT MATCHED THEN
  INSERT (event_id, patient_id, encounter_id, event_type, concept_id, value_num, unit, original_value, original_unit, status, event_time, source_recorded_at)
  VALUES (s.event_id, s.patient_id, s.encounter_id, 'lab',
    (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'WBC'),
    s.value_num, '/uL', TO_VARCHAR(s.value_num), '/CUMM', 'final', s.event_time, s.source_recorded_at);

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (SELECT event_id || '-NEUT' AS event_id, patient_id, encounter_id, neutrophil_pct AS value_num, event_time, source_recorded_at
       FROM SAARTHI.CORE._TMP_CBC_NEAREST_ENCOUNTER) s
ON t.event_id = s.event_id
WHEN NOT MATCHED THEN
  INSERT (event_id, patient_id, encounter_id, event_type, concept_id, value_num, unit, original_value, original_unit, status, event_time, source_recorded_at)
  VALUES (s.event_id, s.patient_id, s.encounter_id, 'lab',
    (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'NEUTROPHIL_PCT'),
    s.value_num, '%', TO_VARCHAR(s.value_num), '%', 'final', s.event_time, s.source_recorded_at);

MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (SELECT event_id || '-PLT' AS event_id, patient_id, encounter_id, platelet_count AS value_num, event_time, source_recorded_at
       FROM SAARTHI.CORE._TMP_CBC_NEAREST_ENCOUNTER) s
ON t.event_id = s.event_id
WHEN NOT MATCHED THEN
  INSERT (event_id, patient_id, encounter_id, event_type, concept_id, value_num, unit, original_value, original_unit, status, event_time, source_recorded_at)
  VALUES (s.event_id, s.patient_id, s.encounter_id, 'lab',
    (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'PLT'),
    s.value_num, '/uL', TO_VARCHAR(s.value_num), '/CUMM', 'final', s.event_time, s.source_recorded_at);

-- HER2 results - discordant across specimens (D3). value_text carries grade/IHC
-- since these are categorical, not numeric.
MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (
  SELECT s.event_id, im.patient_id, s.specimen_id, s.grade, s.ihc_score, s.event_time, s.source_recorded_at
  FROM SAARTHI.CORE.STG_SOURCE_EVENTS s
  JOIN SAARTHI.CORE.ID_MAP im ON im.source_patient_id = s.local_patient_id
  WHERE s.kind = 'her2_result'
) s
ON t.event_id = s.event_id
WHEN NOT MATCHED THEN
  INSERT (event_id, patient_id, event_type, concept_id, value_text, specimen_id, status, event_time, source_recorded_at)
  VALUES (s.event_id, s.patient_id, 'pathology',
    (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'HER2_IHC'),
    'grade=' || s.grade || ' ihc=' || s.ihc_score, s.specimen_id, 'final', s.event_time, s.source_recorded_at);

-- DEXA T-score.
MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
USING (
  SELECT s.event_id, im.patient_id, s.t_score, s.event_time, s.source_recorded_at
  FROM SAARTHI.CORE.STG_SOURCE_EVENTS s
  JOIN SAARTHI.CORE.ID_MAP im ON im.source_patient_id = s.local_patient_id
  WHERE s.kind = 'dexa_scan'
) s
ON t.event_id = s.event_id
WHEN NOT MATCHED THEN
  INSERT (event_id, patient_id, event_type, concept_id, value_num, status, event_time, source_recorded_at)
  VALUES (s.event_id, s.patient_id, 'imaging',
    (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'T_SCORE'),
    s.t_score, 'final', s.event_time, s.source_recorded_at);
