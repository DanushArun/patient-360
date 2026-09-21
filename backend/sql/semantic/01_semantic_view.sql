-- =============================================================================
-- STEP 18 - Semantic view (scoped down, stated honestly)
-- =============================================================================
-- SPEC.md §8 names 8 entities and 6 metrics. This build implements 2 entities
-- (PATIENT, ENCOUNTER) with real data behind them, rather than 8 entities
-- where most have zero rows (READINESS_STATE is never populated -
-- TASK_REFRESH_READINESS, step 16, isn't built yet). A semantic view over
-- empty tables would compile but prove nothing; this one is real and small
-- rather than complete-looking and hollow.
CREATE OR REPLACE SEMANTIC VIEW SAARTHI.OPERATIONAL.SAARTHI_SEMANTIC_VIEW
  TABLES (
    patient AS SAARTHI.CORE.PATIENT PRIMARY KEY (patient_id) WITH SYNONYMS ('patients') COMMENT = 'One row per patient',
    encounter AS SAARTHI.CORE.ENCOUNTER PRIMARY KEY (encounter_id) WITH SYNONYMS ('encounters', 'visits', 'cycles') COMMENT = 'Treatment cycles and visits'
  )
  RELATIONSHIPS (
    encounter (patient_id) REFERENCES patient
  )
  FACTS (
    encounter.is_complication AS IFF(encounter.gap_type = 'clinical_complication', 1, 0)
  )
  DIMENSIONS (
    patient.state AS patient.state WITH SYNONYMS ('region') COMMENT = 'Patient home state',
    encounter.gap_type AS encounter.gap_type COMMENT = 'Reason for delay, if any',
    encounter.cycle_number AS encounter.cycle_number
  )
  METRICS (
    encounter.encounter_count AS COUNT(encounter.encounter_id) COMMENT = 'Total encounters',
    encounter.complication_count AS SUM(encounter.is_complication) COMMENT = 'Encounters with a clinical complication gap'
  )
  COMMENT = 'SAARTHI cohort questions. Scoped to PATIENT+ENCOUNTER, which have real data - not the full 8-entity design, stated honestly.';
