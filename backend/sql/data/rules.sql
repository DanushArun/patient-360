-- =============================================================================
-- STEP 11 - Rules (16, six specialties)
-- =============================================================================
-- SPEC.md §4.3, clinical-thresholds.md. provenance_note is mandatory and is a
-- scoring decision (WORK-PLAN.md): where a threshold is practice consensus
-- rather than a guideline requirement, it says so, and the UI must show it.
--
-- One MERGE per rule, not one giant UNION ALL: 16 simple, independently
-- correct statements are far less fragile than one complex multi-branch
-- subquery, and a mistake in one rule cannot silently corrupt another.

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-ANC-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-ANC-001', 1, 'clinical', 'medical_oncology', 'oncology', 2,
  'ANC recovery',
  'Absolute Neutrophil Count >= 1500/uL required to proceed with cytotoxic chemotherapy',
  PARSE_JSON('{"concept":"ANC","operator":">=","value":1500,"unit":"/uL","max_age_days":7}'),
  'NCCN Myeloid Growth Factors v2.2023; ASCO 2015 (Smith TJ et al.)',
  'standard-dose cytotoxic regimens', 'blocker',
  'Weekly paclitaxel and other protocol-specific regimens may permit >=1000/uL - not modelled as an override in this build');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-PLT-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-PLT-001', 1, 'clinical', 'medical_oncology', 'oncology', 2,
  'Platelet recovery',
  'Platelets >= 100000/uL required for most cytotoxic regimens',
  PARSE_JSON('{"concept":"PLT","operator":">=","value":100000,"unit":"/uL","max_age_days":7}'),
  'NCCN (regimen-specific); CTCAE v5.0',
  'carboplatin, cisplatin, gemcitabine and most cytotoxic regimens', 'blocker',
  'Some protocols (e.g. gemcitabine monotherapy maintenance) permit >=75000/uL - not modelled as a per-regimen override in this build');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-HER2-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-HER2-001', 1, 'documentation', 'medical_oncology', 'breast_cancer', 3,
  'HER2 status final',
  'HER2 status is final on IHC 0/1+/3+; IHC 2+ requires a FISH/ISH result before it is final',
  PARSE_JSON('{"final_if":["ihc IN (0,1,3)","ihc = 2 AND fish_result IS NOT NULL AND fish_result != EQUIVOCAL"],"reflex":"ihc=2 -> FISH"}'),
  'ASCO/CAP 2018 (Wolff AC et al., J Clin Oncol 2018;36(20):2105-2122)',
  'HER2 testing for breast cancer', 'blocker',
  'NCG (India) permits IHC 3+ alone to drive treatment where FISH is unavailable - this build follows NCCN/ASCO and does not implement the resource-stratified NCG exception');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-PATH-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-PATH-001', 1, 'documentation', 'medical_oncology', 'oncology', 2,
  'Final pathology present',
  'A final (not preliminary) histopathology report must be on file before the next cycle',
  PARSE_JSON('{"required_status":"final","not_evaluated_if":"status IN (preliminary,pending)"}'),
  'Institutional standard of care', NULL, 'blocker',
  'No single external guideline cited; standard pre-treatment documentation practice');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-DISC-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-DISC-001', 1, 'documentation', 'medical_oncology', 'oncology', 3,
  'Biomarker discordance across specimens',
  'Grade or IHC/FISH discordance between two specimens (e.g. outside biopsy vs surgical specimen) must be surfaced, never auto-resolved',
  PARSE_JSON('{"relation":"discordant_across_specimens","action":"surface_both_never_auto_resolve"}'),
  'ASCO/CAP 2018 discordance handling', NULL, 'blocker',
  'Discordance detection logic is specimen/accession-based, not guideline-numeric - flagged as a documentation gate rather than a lab threshold');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SURV-LVEF-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SURV-LVEF-001', 1, 'safety', 'cardiology', 'trastuzumab', 3,
  'LVEF assessment recency',
  'LVEF assessment must be no more than 90 days old during trastuzumab/HER2-targeted therapy',
  PARSE_JSON('{"concept":"LVEF","max_age_days":90}'),
  'FDA Herceptin label; NCCN Breast Cancer v4.2023',
  'trastuzumab and other HER2-targeted agents', 'blocker',
  'ESC 2022 extends to every 6 months if stable in metastatic setting after year 1 - not modelled; this build applies the flat 90-day FDA/NCCN interval throughout');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SURV-LVEF-002' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SURV-LVEF-002', 1, 'safety', 'cardiology', 'trastuzumab', 3,
  'LVEF decline threshold',
  'Hold trastuzumab if LVEF drops >=16 points from baseline, or drops >=10 points and current LVEF is below 50',
  PARSE_JSON('{"hold_if":["(baseline_lvef - current_lvef) >= 16","current_lvef < 50 AND (baseline_lvef - current_lvef) >= 10"]}'),
  'FDA Herceptin label; NCCN Breast Cancer v4.2023', NULL, 'blocker',
  'ESC 2022 GLS-based soft-alert (over 12 percent relative decline) not modelled - GLS is not routinely available outside tier-1 Indian centres');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-CRCL-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-CRCL-001', 1, 'clinical', 'nephrology', 'oncology', 3,
  'Creatinine clearance per agent',
  'Cockcroft-Gault CrCl must meet the agent-specific minimum before administration',
  PARSE_JSON('{"formula":"Cockcroft-Gault","per_agent_min_crcl":{"cisplatin":60,"carboplatin":30,"pemetrexed":45,"methotrexate_high_dose":60,"capecitabine":30,"bleomycin":40},"unit":"mL/min"}'),
  'NCCN; FDA labels; Calvert AH et al., J Clin Oncol 1989 (carboplatin)',
  'cisplatin, carboplatin, pemetrexed, high-dose methotrexate, capecitabine, bleomycin', 'blocker',
  'Cockcroft-Gault uses actual body weight; some institutions cap at ideal body weight for obese patients - not standardised, and this build does not apply a weight cap');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-BILI-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-BILI-001', 1, 'clinical', 'hepatology', 'oncology', 3,
  'Hepatic function per agent',
  'Bilirubin and AST/ALT must meet the agent-specific limit, expressed as multiples of the local ULN',
  PARSE_JSON('{"per_agent":{"doxorubicin":{"bilirubin_mg_dl_max":1.2,"ast_x_uln_max":3},"docetaxel":{"bilirubin_x_uln_max":1,"ast_alt_x_uln_max":1.5},"paclitaxel":{"bilirubin_x_uln_max":1.5,"ast_x_uln_max":10}},"classification":"NCI Organ Dysfunction Working Group"}'),
  'NCCN; FDA labels (doxorubicin, docetaxel, paclitaxel)',
  'doxorubicin, docetaxel, paclitaxel', 'blocker',
  'ULN varies by lab; this build uses a configurable institutional default (bilirubin ULN 1.2 mg/dL, AST ULN 40 U/L) rather than per-lab ULN. Gilbert syndrome and liver-metastasis overrides require clinician judgment, not modelled as an automatic exception.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'ENDO-HBA1C-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('ENDO-HBA1C-001', 1, 'safety', 'endocrinology', 'oncology', 2,
  'HbA1c currency before procedure',
  'HbA1c should be below 8.5 percent within 90 days of a planned procedure - advisory only, never blocks oncologic treatment',
  PARSE_JSON('{"concept":"HBA1C","operator":"<","value":8.5,"unit":"%","max_age_days":90,"not_evaluated_if":"haemoglobinopathy, recent transfusion, or CKD recorded"}'),
  'CPOC UK 2022; Association of Anaesthetists 2021',
  'pre-operative / pre-procedure patients', 'advisory',
  'CPOC and the Association of Anaesthetists both state cancer surgery should generally not be deferred for glycaemic optimisation - this rule is explicitly advisory, not a blocker, by design');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'ENDO-DEXA-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('ENDO-DEXA-001', 1, 'safety', 'endocrinology', 'oncology', 2,
  'Bone density surveillance',
  'DEXA T-score band determines the surveillance interval: 24 months if normal, 12 months for osteopenia or osteoporosis or on a bone-modifying agent',
  PARSE_JSON('{"concept":"T_SCORE","strata":[{"when":"t_score>=-1.0","max_age_days":730},{"when":"t_score<-1.0 AND t_score>-2.5","max_age_days":365},{"when":"t_score<=-2.5","max_age_days":365,"additional":"bone_modifying_agent required"},{"when":"on_bone_modifying_agent","max_age_days":365}],"not_evaluated_if":"only QUS available (no T-score)"}'),
  'NCCN Breast v4.2024; ASCO/OH(CCO) 2022; ESMO 2017',
  'patients on an aromatase inhibitor or bone-modifying agent', 'advisory',
  'NCCN says 12 months for osteopenia on AI therapy; ASCO permits up to 24 months. This build implements the tighter NCCN interval as the safer default for a gate whose failure mode is a missed scan.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SURG-CLEAR-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SURG-CLEAR-001', 1, 'documentation', 'general_surgery', 'oncology', 3,
  'Post-operative clearance before resuming systemic therapy',
  'A documented clearance event (wound healing, infection resolution, surgeon sign-off) plus the agent-specific minimum interval are both required',
  PARSE_JSON('{"minimum_interval_days":{"default":21,"bevacizumab":28,"anti_vegf_class":28,"contaminated_wound_flag":42},"required_documented_assertions":["wound_healing_status IN (adequate,healed)","infection_status = resolved","surgical_clearance_signed_by_practitioner IS NOT NULL"],"missing_documentation_outcome":"not_evaluated"}'),
  'FDA bevacizumab label (28-day, hard); NCCN/ESMO perioperative (2-4wk, practice)',
  'patients with a surgical interruption mid-treatment', 'blocker',
  'Only the 28-day anti-VEGF interval is guideline/label mandated. The 21-day default and the 42-day contaminated-wound extension are documented practice consensus, not guideline requirements, and are labelled as such in the UI. The rule requires a documented clearance event and must not infer clearance from elapsed time alone.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'COV-AUTH-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('COV-AUTH-001', 1, 'coverage', NULL, NULL, 1,
  'Authorisation validity',
  'A valid, non-expired, non-conflicting authorisation must exist for the planned package before the encounter',
  PARSE_JSON('{"required_status":"approved","conflicting_if":"table status != letter status"}'),
  'Institutional payer-authorisation practice', NULL, 'blocker',
  'No external guideline; derived from insurance-irdai-nhcx.md operational practice');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'COV-LIMIT-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('COV-LIMIT-001', 1, 'coverage', NULL, NULL, 1,
  'Annual coverage limit',
  'Patient-level used amount must remain within annual limit; for family-floater policies the shared balance is declared unknown, never estimated',
  PARSE_JSON('{"operator":"<","field":"used_amount","limit_field":"annual_limit","family_floater_note":"shared balance unknown - patient-level figure only"}'),
  'PM-JAY scheme rules (Rs 5 lakh per family per year)', NULL, 'advisory',
  'Family-floater true remaining balance depends on other members consumption, which this system does not model - R3 applied: reports what it knows, states what it does not');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'ID-LINK-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('ID-LINK-001', 1, 'identity', NULL, NULL, 1,
  'Identity resolution',
  'All evidence contributing to an answer must resolve to one linked identity via ID_MAP, never joined on name',
  PARSE_JSON('{"link_status_required":["abha_linked","manually_verified"]}'),
  'ABDM identity architecture (abdm-architecture.md)', NULL, 'blocker',
  'No ABHA is the default case for this synthetic cohort - manually_verified is the primary path exercised');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'ID-QUAR-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('ID-QUAR-001', 1, 'identity', NULL, NULL, 1,
  'Quarantined identity contributes no evidence',
  'A quarantined ID_MAP link contributes zero evidence to any answer, gate, or cohort result',
  PARSE_JSON('{"link_status_excluded":["quarantined"]}'),
  'ABDM identity architecture (abdm-architecture.md)', NULL, 'blocker', NULL);
