-- =============================================================================
-- STEP 10a - Ontology seed
-- =============================================================================
-- WORK-PLAN.md Day 4. Closes brief gap G5 ("ontology" named twice in the CoCo
-- guidelines). is_safety_critical drives R7's two-pass extraction.
-- MERGE, never a bare INSERT - setup.sql must run clean a second time (idempotency).
MERGE INTO SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY t
USING (
  SELECT 'ANC' canonical_name, 'analyte' concept_type, TRUE is_safety_critical, ARRAY_CONSTRUCT('absolute neutrophil count','neuts') synonyms
  UNION ALL SELECT 'PLT',        'analyte',   TRUE,  ARRAY_CONSTRUCT('PLT','thrombocytes','platelet count','platelets')
  UNION ALL SELECT 'HER2_IHC',   'biomarker', TRUE,  ARRAY_CONSTRUCT('HER2 immunohistochemistry')
  UNION ALL SELECT 'HER2_FISH',  'biomarker', TRUE,  ARRAY_CONSTRUCT('HER2 in-situ hybridisation')
  UNION ALL SELECT 'CREATININE', 'analyte',   TRUE,  ARRAY_CONSTRUCT('Cr','serum creatinine')
  UNION ALL SELECT 'BILIRUBIN',  'analyte',   TRUE,  ARRAY_CONSTRUCT('T.Bil','total bilirubin')
  UNION ALL SELECT 'AST',        'analyte',   TRUE,  ARRAY_CONSTRUCT('SGOT')
  UNION ALL SELECT 'ALT',        'analyte',   TRUE,  ARRAY_CONSTRUCT('SGPT')
  UNION ALL SELECT 'LVEF',       'procedure', TRUE,  ARRAY_CONSTRUCT('ejection fraction','EF')
  UNION ALL SELECT 'HBA1C',      'analyte',   FALSE, ARRAY_CONSTRUCT('glycated haemoglobin','A1c')
  UNION ALL SELECT 'T_SCORE',    'procedure', FALSE, ARRAY_CONSTRUCT('DEXA T-score','BMD')
  UNION ALL SELECT 'WEIGHT',     'analyte',   FALSE, ARRAY_CONSTRUCT('body weight','wt')
  -- Not in SPEC.md/WORK-PLAN.md's 12-concept ontology list, but UNIT_REGISTRY's
  -- GM% pattern (WORK-PLAN.md Day 4) is a haemoglobin unit and needs a concept
  -- to join to. Added to close that cross-reference gap; flagged, not silent.
  UNION ALL SELECT 'HEMOGLOBIN', 'analyte',   FALSE, ARRAY_CONSTRUCT('Hb','HGB')
  -- Same gap, same reason: WBC and neutrophil percent are the two raw inputs
  -- to the ANC derivation (WBC x neutrophil% / 100, WORK-PLAN.md Day 4-5)
  -- but neither is a named concept in SPEC.md/WORK-PLAN.md's ontology list.
  UNION ALL SELECT 'WBC',        'analyte',   FALSE, ARRAY_CONSTRUCT('white blood cell count','WBC count')
  UNION ALL SELECT 'NEUTROPHIL_PCT', 'analyte', FALSE, ARRAY_CONSTRUCT('neutrophil percent','neutrophils %','PMN%')
) s
ON t.canonical_name = s.canonical_name
WHEN MATCHED THEN
  -- Synonyms are allowed to evolve (this file is the source of truth) - a
  -- redeploy must propagate a widened synonym list, not freeze it at
  -- whatever first loaded. is_safety_critical stays updatable for the
  -- same reason.
  UPDATE SET t.synonyms = s.synonyms, t.is_safety_critical = s.is_safety_critical
WHEN NOT MATCHED THEN
  INSERT (concept_id, concept_type, canonical_name, specialty, synonyms, is_safety_critical)
  VALUES (UUID_STRING(), s.concept_type, s.canonical_name, NULL, s.synonyms, s.is_safety_critical);

-- HER2 IHC reflexes to FISH when 2+ (equivocal) - resolved after both rows exist.
UPDATE SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY ihc
SET reflexes_to_concept_id = (
  SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'HER2_FISH'
)
WHERE ihc.canonical_name = 'HER2_IHC'
  AND ihc.reflexes_to_concept_id IS NULL;
