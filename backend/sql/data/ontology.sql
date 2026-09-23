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
  UNION ALL SELECT 'CREATININE', 'analyte',   TRUE,  ARRAY_CONSTRUCT('Cr','serum creatinine','S. Creatinine','S.Creatinine','creatinine, serum')
  UNION ALL SELECT 'BILIRUBIN',  'analyte',   TRUE,  ARRAY_CONSTRUCT('T.Bil','total bilirubin','S. Bilirubin','bilirubin total','bilirubin, total')
  UNION ALL SELECT 'AST',        'analyte',   TRUE,  ARRAY_CONSTRUCT('SGOT')
  UNION ALL SELECT 'ALT',        'analyte',   TRUE,  ARRAY_CONSTRUCT('SGPT')
  UNION ALL SELECT 'LVEF',       'procedure', TRUE,  ARRAY_CONSTRUCT('ejection fraction','EF')
  UNION ALL SELECT 'HBA1C',      'analyte',   FALSE, ARRAY_CONSTRUCT('glycated haemoglobin','A1c')
  UNION ALL SELECT 'T_SCORE',    'procedure', FALSE, ARRAY_CONSTRUCT('DEXA T-score','BMD')
  UNION ALL SELECT 'WEIGHT',     'analyte',   FALSE, ARRAY_CONSTRUCT('body weight','wt')
  -- Spellings as Indian lab reports print them (SPEC.md line 346 names
  -- 'Haemoglobin|Hb|HGB'; missing it left a live CBC's haemoglobin unmatched,
  -- so it never got a second pass and was never promoted - 24 Sept).
  -- Not in SPEC.md/WORK-PLAN.md's 12-concept ontology list, but UNIT_REGISTRY's
  -- GM% pattern (WORK-PLAN.md Day 4) is a haemoglobin unit and needs a concept
  -- to join to. Added to close that cross-reference gap; flagged, not silent.
  UNION ALL SELECT 'HEMOGLOBIN', 'analyte',   TRUE,  ARRAY_CONSTRUCT('Hb','HGB','Hgb','Haemoglobin','Hemoglobin','Hb%')
  -- Same gap, same reason: WBC and neutrophil percent are the two raw inputs
  -- to the ANC derivation (WBC x neutrophil% / 100, WORK-PLAN.md Day 4-5)
  -- but neither is a named concept in SPEC.md/WORK-PLAN.md's ontology list.
  -- Safety-critical since 24 Sept: ANC, a blocking gate, is computed from WBC and
  -- neutrophil %, so its inputs never rest on a single extraction pass (R7).
  UNION ALL SELECT 'WBC',        'analyte',   TRUE,  ARRAY_CONSTRUCT('white blood cell count','WBC count','TLC','total leucocyte count','total leukocyte count','total WBC count')
  UNION ALL SELECT 'NEUTROPHIL_PCT', 'analyte', TRUE, ARRAY_CONSTRUCT('neutrophil percent','neutrophils %','PMN%','neutrophils (differential)','neutrophils','polymorphs','polymorphs %')
  -- Pre-cycle panels named in the regimen protocols' "TESTS - before each
  -- treatment" sections (evidence/clinical/requirements.yaml, CLIN-PANEL-001).
  UNION ALL SELECT 'SODIUM',     'analyte',   FALSE, ARRAY_CONSTRUCT('Na','serum sodium')
  UNION ALL SELECT 'POTASSIUM',  'analyte',   FALSE, ARRAY_CONSTRUCT('K','serum potassium')
  UNION ALL SELECT 'CALCIUM',    'analyte',   FALSE, ARRAY_CONSTRUCT('Ca','serum calcium')
  UNION ALL SELECT 'MAGNESIUM',  'analyte',   FALSE, ARRAY_CONSTRUCT('Mg','serum magnesium')
  UNION ALL SELECT 'ALBUMIN',    'analyte',   FALSE, ARRAY_CONSTRUCT('Alb','serum albumin')
  UNION ALL SELECT 'ALP',        'analyte',   FALSE, ARRAY_CONSTRUCT('alkaline phosphatase','ALKP')
  UNION ALL SELECT 'LDH',        'analyte',   FALSE, ARRAY_CONSTRUCT('lactate dehydrogenase')
  UNION ALL SELECT 'INR',        'analyte',   TRUE,  ARRAY_CONSTRUCT('PT-INR','international normalised ratio')
  -- Screening tests before systemic therapy (SAFE-HBV-001, SAFE-PREG-001, SAFE-DPYD-001).
  UNION ALL SELECT 'HBSAG',      'analyte',   TRUE,  ARRAY_CONSTRUCT('HBsAg','hepatitis B surface antigen','Australia antigen')
  UNION ALL SELECT 'ANTI_HBC',   'analyte',   TRUE,  ARRAY_CONSTRUCT('anti-HBc','HBcoreAb','hepatitis B core antibody')
  UNION ALL SELECT 'ANTI_HBS',   'analyte',   FALSE, ARRAY_CONSTRUCT('anti-HBs','HBsAb','hepatitis B surface antibody')
  UNION ALL SELECT 'BETA_HCG',   'analyte',   TRUE,  ARRAY_CONSTRUCT('beta-hCG','urine pregnancy test','UPT','serum hCG')
  UNION ALL SELECT 'DPYD',       'biomarker', TRUE,  ARRAY_CONSTRUCT('DPYD genotype','DPD deficiency test','DPYD activity score')
  -- Administrations read by dose rules (DOSE-ANTHRA-001, DOSE-HLOAD-001,
  -- SAFE-PEMVIT-001, SAFE-INR-001). value_num carries the dose; unit says how.
  UNION ALL SELECT 'DOXORUBICIN', 'medication', TRUE, ARRAY_CONSTRUCT('adriamycin','doxorubicin hydrochloride')
  UNION ALL SELECT 'TRASTUZUMAB', 'medication', TRUE, ARRAY_CONSTRUCT('herceptin','trastuzumab biosimilar')
  UNION ALL SELECT 'VITAMIN_B12', 'medication', FALSE, ARRAY_CONSTRUCT('cyanocobalamin','B12 injection')
  UNION ALL SELECT 'FOLIC_ACID',  'medication', FALSE, ARRAY_CONSTRUCT('folate','folic acid tablet')
  UNION ALL SELECT 'WARFARIN',    'medication', TRUE,  ARRAY_CONSTRUCT('coumadin','warfarin sodium')
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
