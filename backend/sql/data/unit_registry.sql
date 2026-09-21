-- =============================================================================
-- STEP 10b - Unit registry seed
-- =============================================================================
-- WORK-PLAN.md Day 4. Prevents a patient-safety bug: creatinine mg/dL vs
-- umol/L differs 88.4x, and CrCl is inversely proportional to it - a missed
-- conversion turns a contraindication into a green light. Values outside
-- plausible_min..plausible_max are rejected as unreadable, never stored.
MERGE INTO SAARTHI.OPERATIONAL.UNIT_REGISTRY t
USING (
  SELECT co.concept_id, s.source_unit_pattern, s.canonical_unit, s.conversion_factor,
         s.plausible_min, s.plausible_max, s.notes
  FROM (
    SELECT * FROM VALUES
      ('HEMOGLOBIN', 'GM%',        'g/dL', 1.0,     3.0,   20.0,      'Indian lab notation for g/dL'),
      ('ANC',        '/CUMM',      '/uL',  1.0,     100.0, 100000.0,  'Per cubic millimetre, numerically equal to /uL'),
      ('CREATININE', 'mg%',        'mg/dL',1.0,     0.1,   20.0,      'Indian lab notation for mg/dL'),
      ('ANC',        'lakhs/cumm', '/uL',  100000.0,10000.0,1000000.0,'1 lakh = 100000; combined with /cumm base unit')
    AS v(canonical_name, source_unit_pattern, canonical_unit, conversion_factor, plausible_min, plausible_max, notes)
  ) s
  JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY co ON co.canonical_name = s.canonical_name
) s
ON t.concept_id = s.concept_id AND t.source_unit_pattern = s.source_unit_pattern
WHEN NOT MATCHED THEN
  INSERT (registry_id, concept_id, canonical_unit, source_unit_pattern, conversion_factor, plausible_min, plausible_max, notes)
  VALUES (UUID_STRING(), s.concept_id, s.canonical_unit, s.source_unit_pattern, s.conversion_factor, s.plausible_min, s.plausible_max, s.notes);
