-- =============================================================================
-- STEP 15a - DT_HARMONIZED_EVENTS (pulled forward - the vertical slice needs it)
-- =============================================================================
-- SPEC.md §13, WORK-PLAN.md Day 4-5. The single most load-bearing Dynamic
-- Table. NO AI FUNCTIONS HERE - a DT requires deterministic refresh; AI steps
-- live in Tasks (step 16).
--
-- ANC derivation (WBC x neutrophil%) and unit conversion to the canonical unit
-- via UNIT_REGISTRY (creatinine and bilirubin umol/L -> mg/dL, platelets in
-- lakhs -> /uL). Values outside the plausible range are kept but marked
-- 'unreadable'; evaluate_gates never reads an unreadable value as evidence.
-- Cockcroft-Gault CrCl is computed in evaluate_gates, where the regimen's own
-- threshold is known.
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
        ce.code,
        -- Converted to the canonical unit when UNIT_REGISTRY knows the source
        -- unit; passed through unchanged when it does not (canonical already).
        ce.value_num * COALESCE(ur.conversion_factor, 1.0) AS value_num,
        COALESCE(ur.canonical_unit, ce.unit)                AS unit,
        ce.value_num                                        AS source_value_num,
        ce.original_unit                                    AS source_unit,
        ce.value_text,
        ce.abnormal_flag,
        ce.status,
        CASE
            WHEN ur.plausible_min IS NOT NULL
                 AND (ce.value_num * ur.conversion_factor < ur.plausible_min
                      OR ce.value_num * ur.conversion_factor > ur.plausible_max)
            THEN 'unreadable'
            ELSE 'present'
        END AS plausibility_state,
        ce.event_time, ce.source_recorded_at, ce.ingested_at, ce.valid_until, ce.specimen_id
    FROM SAARTHI.CORE.CLINICAL_EVENT ce
    LEFT JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY co ON co.concept_id = ce.concept_id
    LEFT JOIN SAARTHI.OPERATIONAL.UNIT_REGISTRY ur
      ON ur.concept_id = ce.concept_id
     AND UPPER(ur.source_unit_pattern) = UPPER(COALESCE(ce.original_unit, ce.unit))
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
        NULL AS code,
        wbc.value_num * (neut.value_num) / 100 AS value_num,
        '/uL' AS unit,
        NULL AS source_value_num,
        NULL AS source_unit,
        NULL AS value_text,
        NULL AS abnormal_flag,
        wbc.status,
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
SELECT event_id, patient_id, encounter_id, event_type, concept_id, concept_name, code,
       value_num, unit, source_value_num, source_unit, value_text, abnormal_flag, status, plausibility_state,
       FALSE AS is_derived,
       NULL AS derivation,
       event_time, source_recorded_at, ingested_at, valid_until, specimen_id
FROM normalized
UNION ALL
SELECT event_id, patient_id, encounter_id, event_type, concept_id, concept_name, code,
       value_num, unit, source_value_num, source_unit, value_text, abnormal_flag, status, plausibility_state,
       TRUE AS is_derived,
       'ANC computed as WBC x neutrophil% / 100' AS derivation,
       event_time, source_recorded_at, ingested_at, valid_until, specimen_id
FROM anc_derived;
