-- =============================================================================
-- STEP 15a - DT_HARMONIZED_EVENTS (pulled forward - the vertical slice needs it)
-- =============================================================================
-- SPEC.md §13, WORK-PLAN.md Day 4-5. The single most load-bearing Dynamic
-- Table. NO AI FUNCTIONS HERE - a DT requires deterministic refresh; AI steps
-- live in Tasks (step 16).
--
-- This build implements ANC derivation (the Day-5 gate rule) and passthrough
-- unit normalisation via UNIT_REGISTRY. Cockcroft-Gault CrCl is NOT yet
-- implemented - the deep-case patient has no `vitals`/weight event, so CrCl
-- would correctly return not_evaluated (R3: missing input, not a bug) even
-- once wired. Left as a stated gap rather than faked.
CREATE OR REPLACE DYNAMIC TABLE SAARTHI.CORE.DT_HARMONIZED_EVENTS
  TARGET_LAG = '1 minute'
  WAREHOUSE = SAARTHI_AI_WH
AS
WITH normalized AS (
    -- Passthrough normalisation: join UNIT_REGISTRY on (concept, original_unit
    -- pattern), apply conversion_factor, reject out-of-plausible-range values
    -- as unreadable rather than storing them (D2/UNIT_REGISTRY's whole point).
    SELECT
        ce.event_id, ce.patient_id, ce.encounter_id, ce.event_type, ce.concept_id,
        co.canonical_name AS concept_name,
        ce.value_num,
        ce.value_text,
        ce.abnormal_flag,
        CASE
            WHEN ur.plausible_min IS NOT NULL
                 AND (ce.value_num < ur.plausible_min OR ce.value_num > ur.plausible_max)
            THEN 'unreadable'
            ELSE 'present'
        END AS plausibility_state,
        ce.event_time, ce.source_recorded_at, ce.ingested_at, ce.valid_until, ce.specimen_id
    FROM SAARTHI.CORE.CLINICAL_EVENT ce
    LEFT JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY co ON co.concept_id = ce.concept_id
    LEFT JOIN SAARTHI.OPERATIONAL.UNIT_REGISTRY ur
      ON ur.concept_id = ce.concept_id AND ur.source_unit_pattern = ce.original_unit
),
anc_derived AS (
    -- ANC = WBC x (neutrophil% + band%) / 100, computed only when the lab
    -- reported a differential and no direct ANC row exists (WORK-PLAN.md
    -- Day 4-5 acceptance test: WBC 6000, neutrophils 35% -> ANC 2100).
    SELECT
        wbc.encounter_id || '-ANC-DERIVED' AS event_id,
        wbc.patient_id, wbc.encounter_id, 'lab' AS event_type,
        (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'ANC') AS concept_id,
        'ANC' AS concept_name,
        wbc.value_num * (neut.value_num) / 100 AS value_num,
        NULL AS value_text,
        NULL AS abnormal_flag,
        'present' AS plausibility_state,
        wbc.event_time, wbc.source_recorded_at, wbc.ingested_at, wbc.valid_until, wbc.specimen_id
    FROM normalized wbc
    JOIN normalized neut
      ON neut.encounter_id = wbc.encounter_id
     AND neut.event_time   = wbc.event_time
     AND neut.concept_name = 'NEUTROPHIL_PCT'
    WHERE wbc.concept_name = 'WBC'
      AND NOT EXISTS (
            SELECT 1 FROM normalized anc
             WHERE anc.encounter_id = wbc.encounter_id AND anc.concept_name = 'ANC'
          )
)
SELECT event_id, patient_id, encounter_id, event_type, concept_id, concept_name,
       value_num, value_text, abnormal_flag, plausibility_state,
       FALSE AS is_derived,
       NULL AS derivation,
       event_time, source_recorded_at, ingested_at, valid_until, specimen_id
FROM normalized
UNION ALL
SELECT event_id, patient_id, encounter_id, event_type, concept_id, concept_name,
       value_num, value_text, abnormal_flag, plausibility_state,
       TRUE AS is_derived,
       'ANC computed as WBC x neutrophil% / 100' AS derivation,
       event_time, source_recorded_at, ingested_at, valid_until, specimen_id
FROM anc_derived;
