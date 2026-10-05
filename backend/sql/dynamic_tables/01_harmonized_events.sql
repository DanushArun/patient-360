-- =============================================================================
-- STEP 15a - DT_HARMONIZED_EVENTS (pulled forward - the vertical slice needs it)
-- =============================================================================
-- SPEC.md §13, WORK-PLAN.md Day 4-5. The single most load-bearing Dynamic
-- Table. NO AI FUNCTIONS HERE - a DT requires deterministic refresh; AI steps
-- live in Tasks (step 16).
--
-- This build implements ANC derivation and registered conversions, preserving
-- canonical values without double conversion. CrCl is evaluated by evaluate_gates,
-- not materialized here. Missing required inputs yield not_evaluated.
CREATE OR REPLACE DYNAMIC TABLE SAARTHI.CORE.DT_HARMONIZED_EVENTS
  TARGET_LAG = '1 minute'
  WAREHOUSE = SAARTHI_AI_WH
AS
WITH converted AS (
    SELECT ce.*, co.canonical_name AS concept_name,
           ur.canonical_unit, ur.plausible_min, ur.plausible_max,
           CASE WHEN ur.canonical_unit IS NULL THEN ce.value_num
                WHEN ce.unit = ur.canonical_unit THEN ce.value_num
                WHEN ce.unit = ur.source_unit_pattern AND ur.conversion_factor > 0
                  THEN ce.value_num * ur.conversion_factor
                ELSE NULL END AS normalized_value
      FROM SAARTHI.CORE.CLINICAL_EVENT ce
      LEFT JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY co ON co.concept_id = ce.concept_id
      LEFT JOIN SAARTHI.OPERATIONAL.UNIT_REGISTRY ur
        ON ur.concept_id = ce.concept_id AND ur.source_unit_pattern = ce.original_unit
),
normalized AS (
    SELECT event_id, patient_id, encounter_id, event_type, concept_id, concept_name,
           normalized_value AS value_num, value_text, abnormal_flag,
           CASE WHEN value_num IS NOT NULL AND normalized_value IS NULL THEN 'unreadable'
                WHEN plausible_min IS NOT NULL AND normalized_value < plausible_min
                  THEN 'unreadable'
                WHEN plausible_max IS NOT NULL AND normalized_value > plausible_max
                  THEN 'unreadable'
                ELSE 'present' END AS plausibility_state,
           event_time, source_recorded_at, ingested_at, valid_until, specimen_id,
           COALESCE(canonical_unit,unit) AS unit
      FROM converted
),
anc_derived AS (
    -- ANC = WBC x (neutrophil% + band%) / 100, computed only when the lab
    -- reported a differential and no direct ANC row exists (WORK-PLAN.md
    -- Day 4-5 acceptance test: WBC 6000, neutrophils 35% -> ANC 2100).
    SELECT
        wbc.event_id || '-ANC-DERIVED' AS event_id,
        wbc.patient_id, wbc.encounter_id, 'lab' AS event_type,
        (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'ANC') AS concept_id,
        'ANC' AS concept_name,
        wbc.value_num * (neut.value_num) / 100 AS value_num,
        NULL AS value_text,
        NULL AS abnormal_flag,
        'present' AS plausibility_state,
        wbc.event_time,
        CASE WHEN wbc.source_recorded_at > neut.source_recorded_at
             THEN wbc.source_recorded_at ELSE neut.source_recorded_at END AS source_recorded_at,
        CASE WHEN wbc.ingested_at > neut.ingested_at
             THEN wbc.ingested_at ELSE neut.ingested_at END AS ingested_at,
        wbc.valid_until, wbc.specimen_id, wbc.unit
    FROM normalized wbc
    JOIN normalized neut
      ON neut.patient_id = wbc.patient_id
     AND neut.encounter_id = wbc.encounter_id
     -- Null-safe: structured CBC feeds often carry no specimen_id, and NULL = NULL
     -- would silently drop every derivation. The COUNT = 1 guard below still
     -- refuses to pick between two differentials for the same draw.
     AND neut.specimen_id IS NOT DISTINCT FROM wbc.specimen_id
     AND neut.event_time   = wbc.event_time
     AND neut.concept_name = 'NEUTROPHIL_PCT'
    WHERE wbc.concept_name = 'WBC'
      AND wbc.plausibility_state = 'present' AND neut.plausibility_state = 'present'
      AND wbc.value_num > 0 AND neut.value_num BETWEEN 0 AND 100
      AND wbc.unit IN ('/uL','/cumm','/CUMM') AND neut.unit = '%'
      AND wbc.source_recorded_at IS NOT NULL AND neut.source_recorded_at IS NOT NULL
      AND wbc.ingested_at IS NOT NULL AND neut.ingested_at IS NOT NULL
      AND 1 = (SELECT COUNT(*) FROM normalized differential
                WHERE differential.patient_id = wbc.patient_id
                  AND differential.encounter_id = wbc.encounter_id
                  AND differential.specimen_id IS NOT DISTINCT FROM wbc.specimen_id
                  AND differential.event_time = wbc.event_time
                  AND differential.concept_name = 'NEUTROPHIL_PCT')
      AND NOT EXISTS (
            SELECT 1 FROM normalized anc
             WHERE anc.patient_id = wbc.patient_id
               AND anc.encounter_id = wbc.encounter_id
               AND anc.specimen_id IS NOT DISTINCT FROM wbc.specimen_id
               AND anc.event_time = wbc.event_time AND anc.concept_name = 'ANC'
          )
)
SELECT event_id, patient_id, encounter_id, event_type, concept_id, concept_name,
       value_num, value_text, abnormal_flag, plausibility_state,
       FALSE AS is_derived,
       NULL AS derivation,
       event_time, source_recorded_at, ingested_at, valid_until, specimen_id, unit
FROM normalized
UNION ALL
SELECT event_id, patient_id, encounter_id, event_type, concept_id, concept_name,
       value_num, value_text, abnormal_flag, plausibility_state,
       TRUE AS is_derived,
       'ANC computed as WBC x neutrophil% / 100' AS derivation,
       event_time, source_recorded_at, ingested_at, valid_until, specimen_id, unit
FROM anc_derived;
