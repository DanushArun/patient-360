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

-- =============================================================================
-- STEP 11 (continued) - Rule versions of 23 Sept 2026
-- =============================================================================
-- Every number below is quoted, with page, in evidence/clinical/requirements.yaml
-- and machine-checked against its source by backend/scripts/verify_clinical_proof.py.
-- v2 rows correct v1 rules whose numbers disagreed with the governing regimen
-- protocol; v1 rows are kept (never edited) and closed with effective_to, so a
-- gate outcome always names the rule version that produced it.
-- New v1 rows close record-state gaps the ledger found (consent, hepatitis B,
-- pregnancy status, DPYD, cumulative dose, ...).

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-ANC-001' AS rule_id, 2 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"ANC","operator":">=","value":1500,"unit":"/uL","max_age_days":7,"per_regimen":{"AC":1500,"TH":1000,"FOLFOX":1200,"CAPOX":1200,"CIS-RT-HN":1500,"CIS-RT-CX":800,"PEM-CARBO":1500,"AC-TH":1500},"reduced_dose_band":{"AC":[1000,1500],"CIS-RT-HN":[1000,1500],"AC-TH":[1000,1500]},"not_applicable_if":"regimen not myelosuppressive (REGIMEN_REGISTRY)"}'), t.guideline_ref = 'BC Cancer BRAJAC p2, BRAJTTW p5, BRAJACTT p3, GIAJFFOX p4, GIGAVCOX p4, HNLAPRT p3, GOCXCRT p2, LUAVPP p2',
  t.provenance_note = 'v2 replaces the flat 1500 of v1, which blocked FOLFOX/CAPOX (1200), weekly paclitaxel (1000) and weekly cervix cisplatin (800) patients the protocols treat. Unknown regimen falls back to 1500. Inside a reduced-dose band the gate fails with the band named: a prescriber dose decision is needed before the chair.', t.severity = 'blocker', t.description = 'Absolute neutrophil count must meet the full-dose threshold of the patient''s regimen protocol, measured within 7 days'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-ANC-001', 2, 'clinical', 'medical_oncology', 'oncology', 2,
  'ANC recovery (per regimen)',
  'Absolute neutrophil count must meet the full-dose threshold of the patient''s regimen protocol, measured within 7 days',
  PARSE_JSON('{"concept":"ANC","operator":">=","value":1500,"unit":"/uL","max_age_days":7,"per_regimen":{"AC":1500,"TH":1000,"FOLFOX":1200,"CAPOX":1200,"CIS-RT-HN":1500,"CIS-RT-CX":800,"PEM-CARBO":1500,"AC-TH":1500},"reduced_dose_band":{"AC":[1000,1500],"CIS-RT-HN":[1000,1500],"AC-TH":[1000,1500]},"not_applicable_if":"regimen not myelosuppressive (REGIMEN_REGISTRY)"}'),
  'BC Cancer BRAJAC p2, BRAJTTW p5, BRAJACTT p3, GIAJFFOX p4, GIGAVCOX p4, HNLAPRT p3, GOCXCRT p2, LUAVPP p2',
  'myelosuppressive regimens', 'blocker',
  'v2 replaces the flat 1500 of v1, which blocked FOLFOX/CAPOX (1200), weekly paclitaxel (1000) and weekly cervix cisplatin (800) patients the protocols treat. Unknown regimen falls back to 1500. Inside a reduced-dose band the gate fails with the band named: a prescriber dose decision is needed before the chair.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-PLT-001' AS rule_id, 2 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"PLT","operator":">=","value":100000,"unit":"/uL","max_age_days":7,"per_regimen":{"AC":90000,"TH":90000,"FOLFOX":75000,"CAPOX":75000,"CIS-RT-HN":100000,"CIS-RT-CX":80000,"PEM-CARBO":100000,"AC-TH":90000},"reduced_dose_band":{"AC":[70000,90000],"CIS-RT-HN":[75000,100000],"AC-TH":[70000,90000]},"not_applicable_if":"regimen not myelosuppressive (REGIMEN_REGISTRY)"}'), t.guideline_ref = 'BC Cancer BRAJAC p2, BRAJTTW p5, BRAJACTT p3, GIAJFFOX p4, GIGAVCOX p4, HNLAPRT p3, GOCXCRT p2, LUAVPP p2',
  t.provenance_note = 'v2 replaces the flat 100000 of v1. Unknown regimen falls back to 100000.', t.severity = 'blocker', t.description = 'Platelets must meet the full-dose threshold of the patient''s regimen protocol, measured within 7 days'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-PLT-001', 2, 'clinical', 'medical_oncology', 'oncology', 2,
  'Platelet recovery (per regimen)',
  'Platelets must meet the full-dose threshold of the patient''s regimen protocol, measured within 7 days',
  PARSE_JSON('{"concept":"PLT","operator":">=","value":100000,"unit":"/uL","max_age_days":7,"per_regimen":{"AC":90000,"TH":90000,"FOLFOX":75000,"CAPOX":75000,"CIS-RT-HN":100000,"CIS-RT-CX":80000,"PEM-CARBO":100000,"AC-TH":90000},"reduced_dose_band":{"AC":[70000,90000],"CIS-RT-HN":[75000,100000],"AC-TH":[70000,90000]},"not_applicable_if":"regimen not myelosuppressive (REGIMEN_REGISTRY)"}'),
  'BC Cancer BRAJAC p2, BRAJTTW p5, BRAJACTT p3, GIAJFFOX p4, GIGAVCOX p4, HNLAPRT p3, GOCXCRT p2, LUAVPP p2',
  'myelosuppressive regimens', 'blocker',
  'v2 replaces the flat 100000 of v1. Unknown regimen falls back to 100000.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-CRCL-001' AS rule_id, 2 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"formula":"Cockcroft-Gault","unit":"mL/min","max_age_days":7,"weight_max_age_days":30,"per_regimen_min_crcl":{"CIS-RT-HN":60,"CIS-RT-CX":50,"PEM-CARBO":45,"CAPOX":30},"reduced_dose_band":{"CIS-RT-HN":[45,60]},"per_agent_min_crcl":{"cisplatin":60,"pemetrexed":45,"capecitabine":30,"methotrexate_high_dose":60,"bleomycin":40},"unknown_regimen_min_crcl":60}'), t.guideline_ref = 'BC Cancer HNLAPRT p3, GOCXCRT p2, LUAVPP p2, GIGAVCOX p6; FDA labels',
  t.provenance_note = 'v1''s evaluator ignored the regimen and passed any CrCl >= 30, so a cisplatin patient at 40 mL/min showed as ready. v2 applies the regimen''s own number, requires a creatinine within 7 days and a weight within 30, and computes age at the encounter. Carboplatin is removed: it is dosed from kidney function (Calvert AUC formula), not gated by it.', t.severity = 'blocker', t.description = 'Cockcroft-Gault creatinine clearance, from a creatinine measured within 7 days, must meet the patient''s regimen protocol'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-CRCL-001', 2, 'clinical', 'nephrology', 'oncology', 3,
  'Creatinine clearance (per regimen)',
  'Cockcroft-Gault creatinine clearance, from a creatinine measured within 7 days, must meet the patient''s regimen protocol',
  PARSE_JSON('{"formula":"Cockcroft-Gault","unit":"mL/min","max_age_days":7,"weight_max_age_days":30,"per_regimen_min_crcl":{"CIS-RT-HN":60,"CIS-RT-CX":50,"PEM-CARBO":45,"CAPOX":30},"reduced_dose_band":{"CIS-RT-HN":[45,60]},"per_agent_min_crcl":{"cisplatin":60,"pemetrexed":45,"capecitabine":30,"methotrexate_high_dose":60,"bleomycin":40},"unknown_regimen_min_crcl":60}'),
  'BC Cancer HNLAPRT p3, GOCXCRT p2, LUAVPP p2, GIGAVCOX p6; FDA labels',
  'cisplatin, pemetrexed, capecitabine regimens', 'blocker',
  'v1''s evaluator ignored the regimen and passed any CrCl >= 30, so a cisplatin patient at 40 mL/min showed as ready. v2 applies the regimen''s own number, requires a creatinine within 7 days and a weight within 30, and computes age at the encounter. Carboplatin is removed: it is dosed from kidney function (Calvert AUC formula), not gated by it.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-BILI-001' AS rule_id, 2 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"uln_mg_dl":1.2,"max_age_days":7,"per_agent":{"doxorubicin":{"bilirubin_mg_dl_max":1.2,"action":"20-50 micromol/L: 50% dose; >85: do not administer (BC Cancer doxorubicin monograph p9)"},"paclitaxel":{"bilirubin_x_uln_max":1.25,"action":"1.26-2 x ULN: 60 mg/m2; 2.01-5 x ULN: 40 mg/m2 (BRAJTTW p5)"},"docetaxel":{"bilirubin_x_uln_max":1.0,"action":"above ULN: not recommended (FDA label)"}},"unknown_regimen_mg_dl_max":1.2}'), t.guideline_ref = 'BC Cancer doxorubicin monograph p9; BRAJTTW p5; FDA docetaxel label',
  t.provenance_note = 'v1''s evaluator ignored the regimen and passed bilirubin up to 1.8 mg/dL for everyone, and its paclitaxel limit (1.5 x ULN) was looser than BRAJTTW (1.25 x ULN). ULN is a configurable institutional default (1.2 mg/dL), not per-lab.', t.severity = 'blocker', t.description = 'Total bilirubin, measured within 7 days, must be within the full-dose limit of every hepatically-cleared drug in the regimen'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-BILI-001', 2, 'clinical', 'hepatology', 'oncology', 3,
  'Bilirubin for the patient''s drugs',
  'Total bilirubin, measured within 7 days, must be within the full-dose limit of every hepatically-cleared drug in the regimen',
  PARSE_JSON('{"uln_mg_dl":1.2,"max_age_days":7,"per_agent":{"doxorubicin":{"bilirubin_mg_dl_max":1.2,"action":"20-50 micromol/L: 50% dose; >85: do not administer (BC Cancer doxorubicin monograph p9)"},"paclitaxel":{"bilirubin_x_uln_max":1.25,"action":"1.26-2 x ULN: 60 mg/m2; 2.01-5 x ULN: 40 mg/m2 (BRAJTTW p5)"},"docetaxel":{"bilirubin_x_uln_max":1.0,"action":"above ULN: not recommended (FDA label)"}},"unknown_regimen_mg_dl_max":1.2}'),
  'BC Cancer doxorubicin monograph p9; BRAJTTW p5; FDA docetaxel label',
  'doxorubicin, paclitaxel, docetaxel regimens', 'blocker',
  'v1''s evaluator ignored the regimen and passed bilirubin up to 1.8 mg/dL for everyone, and its paclitaxel limit (1.5 x ULN) was looser than BRAJTTW (1.25 x ULN). ULN is a configurable institutional default (1.2 mg/dL), not per-lab.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SURV-LVEF-001' AS rule_id, 2 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"LVEF","max_age_days":90,"min_value":50,"discretion_band":[45,50],"after_last_anthracycline":true}'), t.guideline_ref = 'FDA Herceptin label p3, p6; BC Cancer BRAJTTW p1, BRAJTR p1',
  t.provenance_note = '90 days follows the FDA label (every 3 months); BC Cancer BRAJTR allows up to 4 months. 45-50% is treat-at-physician-discretion in BRAJTTW and is reported as a fail naming that band.', t.severity = 'blocker', t.description = 'On HER2-targeted therapy: LVEF measured within 90 days, at least 50%, and measured after the last anthracycline dose'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SURV-LVEF-001', 2, 'safety', 'cardiology', 'trastuzumab', 3,
  'LVEF recency, value and post-anthracycline echo',
  'On HER2-targeted therapy: LVEF measured within 90 days, at least 50%, and measured after the last anthracycline dose',
  PARSE_JSON('{"concept":"LVEF","max_age_days":90,"min_value":50,"discretion_band":[45,50],"after_last_anthracycline":true}'),
  'FDA Herceptin label p3, p6; BC Cancer BRAJTTW p1, BRAJTR p1',
  'trastuzumab and other HER2-targeted agents', 'blocker',
  '90 days follows the FDA label (every 3 months); BC Cancer BRAJTR allows up to 4 months. 45-50% is treat-at-physician-discretion in BRAJTTW and is reported as a fail naming that band.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'CLIN-PANEL-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"max_age_days":7,"cbc_if_myelosuppressive":["HEMOGLOBIN","WBC","ANC","PLT"],"per_regimen":{"AC":[],"TH":[],"FOLFOX":["CREATININE","BILIRUBIN","ALT"],"CAPOX":["CREATININE","BILIRUBIN","ALT"],"CIS-RT-HN":["CREATININE","SODIUM","POTASSIUM","CALCIUM","ALBUMIN","MAGNESIUM"],"CIS-RT-CX":["CREATININE"],"PEM-CARBO":["CREATININE","ALP","ALT","BILIRUBIN","LDH"],"AC-TH":[]}}'), t.guideline_ref = 'BC Cancer TESTS sections (BRAJAC p1, BRAJTTW p1, GIAJFFOX p1, GIGAVCOX p1, HNLAPRT p1, GOCXCRT p1, LUAVPP p1); AIIMS Jodhpur checklist item 4',
  t.provenance_note = 'CBC & Diff is read as haemoglobin, WBC, ANC and platelets. Trastuzumab alone (BRAJTR) makes the CBC optional, so the CBC part does not apply to it.', t.severity = 'blocker', t.description = 'Every test the regimen protocol lists ''before each treatment'' has a result within 7 days'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('CLIN-PANEL-001', 1, 'clinical', 'medical_oncology', 'oncology', 2,
  'Pre-cycle blood panel complete',
  'Every test the regimen protocol lists ''before each treatment'' has a result within 7 days',
  PARSE_JSON('{"max_age_days":7,"cbc_if_myelosuppressive":["HEMOGLOBIN","WBC","ANC","PLT"],"per_regimen":{"AC":[],"TH":[],"FOLFOX":["CREATININE","BILIRUBIN","ALT"],"CAPOX":["CREATININE","BILIRUBIN","ALT"],"CIS-RT-HN":["CREATININE","SODIUM","POTASSIUM","CALCIUM","ALBUMIN","MAGNESIUM"],"CIS-RT-CX":["CREATININE"],"PEM-CARBO":["CREATININE","ALP","ALT","BILIRUBIN","LDH"],"AC-TH":[]}}'),
  'BC Cancer TESTS sections (BRAJAC p1, BRAJTTW p1, GIAJFFOX p1, GIGAVCOX p1, HNLAPRT p1, GOCXCRT p1, LUAVPP p1); AIIMS Jodhpur checklist item 4',
  'all regimens with a pre-treatment test list', 'blocker',
  'CBC & Diff is read as haemoglobin, WBC, ANC and platelets. Trastuzumab alone (BRAJTR) makes the CBC optional, so the CBC part does not apply to it.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SAFE-HBV-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"required":["HBSAG","ANTI_HBC"]}'), t.guideline_ref = 'BC Cancer HNLAPRT p1, p4; ASCO provisional clinical opinion 2020 (Hwang et al.)',
  t.provenance_note = 'Advisory, not blocking: HNLAPRT says results do not have to be available to proceed, and ASCO says therapy should not be delayed for them.', t.severity = 'advisory', t.description = 'HBsAg and anti-HBc results are on record before systemic anticancer therapy'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SAFE-HBV-001', 1, 'safety', 'medical_oncology', 'oncology', 1,
  'Hepatitis B screening on file',
  'HBsAg and anti-HBc results are on record before systemic anticancer therapy',
  PARSE_JSON('{"required":["HBSAG","ANTI_HBC"]}'),
  'BC Cancer HNLAPRT p1, p4; ASCO provisional clinical opinion 2020 (Hwang et al.)',
  'all systemic therapy', 'advisory',
  'Advisory, not blocking: HNLAPRT says results do not have to be available to proceed, and ASCO says therapy should not be delayed for them.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SAFE-PREG-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"BETA_HCG","applies_if":"trastuzumab in regimen AND female AND age < 50 at the encounter"}'), t.guideline_ref = 'FDA Herceptin label p3 (boxed warning: embryo-fetal toxicity)',
  t.provenance_note = 'Menopausal status is not recorded, so age under 50 is used as the proxy for reproductive potential - stated, not hidden. A positive result fails the gate.', t.severity = 'blocker', t.description = 'Before trastuzumab, a pregnancy test result is on record for a woman of reproductive potential'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SAFE-PREG-001', 1, 'safety', 'medical_oncology', 'trastuzumab', 3,
  'Pregnancy status verified',
  'Before trastuzumab, a pregnancy test result is on record for a woman of reproductive potential',
  PARSE_JSON('{"concept":"BETA_HCG","applies_if":"trastuzumab in regimen AND female AND age < 50 at the encounter"}'),
  'FDA Herceptin label p3 (boxed warning: embryo-fetal toxicity)',
  'women of reproductive potential on trastuzumab', 'blocker',
  'Menopausal status is not recorded, so age under 50 is used as the proxy for reproductive potential - stated, not hidden. A positive result fails the gate.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SAFE-DPYD-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"DPYD","agents":["fluorouracil","capecitabine"],"tolerated_if":"cycle_number > 1"}'), t.guideline_ref = 'BC Cancer GIAJFFOX p1, GIGAVCOX p1',
  t.provenance_note = 'Follows the protocol wording: ''not required if previously tested, or tolerated fluorouracil or capecitabine''. A reduced-activity result fails the gate so the dose is set from the DPYD activity score.', t.severity = 'blocker', t.description = 'Before fluorouracil or capecitabine: a DPYD result on record, or prior cycles of the drug tolerated'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SAFE-DPYD-001', 1, 'safety', 'medical_oncology', 'oncology', 3,
  'DPYD status before fluoropyrimidines',
  'Before fluorouracil or capecitabine: a DPYD result on record, or prior cycles of the drug tolerated',
  PARSE_JSON('{"concept":"DPYD","agents":["fluorouracil","capecitabine"],"tolerated_if":"cycle_number > 1"}'),
  'BC Cancer GIAJFFOX p1, GIGAVCOX p1',
  'fluorouracil, capecitabine regimens', 'blocker',
  'Follows the protocol wording: ''not required if previously tested, or tolerated fluorouracil or capecitabine''. A reduced-activity result fails the gate so the dose is set from the DPYD activity score.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOSE-ANTHRA-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"DOXORUBICIN","max_cumulative_mg_m2":400,"planned_dose_mg_m2":{"AC":60}}'), t.guideline_ref = 'BC Cancer BRAJAC p2; doxorubicin monograph p8 (550 mg/m2 suggested maximum)',
  t.provenance_note = 'Sums administered doses on record from any facility. Earlier cycles with no administration record make the total unknown (not_evaluated), never assumed zero.', t.severity = 'blocker', t.description = 'Lifetime doxorubicin including this cycle stays at or under 400 mg/m2 without a cardiac assessment'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOSE-ANTHRA-001', 1, 'safety', 'cardiology', 'oncology', 3,
  'Cumulative doxorubicin',
  'Lifetime doxorubicin including this cycle stays at or under 400 mg/m2 without a cardiac assessment',
  PARSE_JSON('{"concept":"DOXORUBICIN","max_cumulative_mg_m2":400,"planned_dose_mg_m2":{"AC":60}}'),
  'BC Cancer BRAJAC p2; doxorubicin monograph p8 (550 mg/m2 suggested maximum)',
  'doxorubicin regimens', 'blocker',
  'Sums administered doses on record from any facility. Earlier cycles with no administration record make the total unknown (not_evaluated), never assumed zero.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOSE-HLOAD-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"TRASTUZUMAB","max_gap_days":42,"loading_dose":"8 mg/kg"}'), t.guideline_ref = 'BC Cancer BRAJTTW p4, BRAJTR p3',
  t.provenance_note = 'A fail here is an order change (loading dose), not a stop: the prescriber must know before the drug is prepared.', t.severity = 'blocker', t.description = 'More than 6 weeks since the last trastuzumab dose means the 8 mg/kg loading dose is repeated'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOSE-HLOAD-001', 1, 'clinical', 'medical_oncology', 'trastuzumab', 3,
  'Trastuzumab loading after an interruption',
  'More than 6 weeks since the last trastuzumab dose means the 8 mg/kg loading dose is repeated',
  PARSE_JSON('{"concept":"TRASTUZUMAB","max_gap_days":42,"loading_dose":"8 mg/kg"}'),
  'BC Cancer BRAJTTW p4, BRAJTR p3',
  'trastuzumab regimens', 'blocker',
  'A fail here is an order change (loading dose), not a stop: the prescriber must know before the drug is prepared.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SAFE-PEMVIT-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"b12_concept":"VITAMIN_B12","b12_max_age_days":63,"folate_concept":"FOLIC_ACID","folate_max_age_days":30}'), t.guideline_ref = 'BC Cancer LUAVPP p1 (premedications), p2 (precaution 1)',
  t.provenance_note = 'The protocol calls supplementation mandatory; febrile neutropenia is more frequent without it.', t.severity = 'blocker', t.description = 'Before pemetrexed: vitamin B12 injection within 9 weeks and folic acid on record'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SAFE-PEMVIT-001', 1, 'safety', 'medical_oncology', 'oncology', 3,
  'Pemetrexed vitamin supplementation',
  'Before pemetrexed: vitamin B12 injection within 9 weeks and folic acid on record',
  PARSE_JSON('{"b12_concept":"VITAMIN_B12","b12_max_age_days":63,"folate_concept":"FOLIC_ACID","folate_max_age_days":30}'),
  'BC Cancer LUAVPP p1 (premedications), p2 (precaution 1)',
  'pemetrexed regimens', 'blocker',
  'The protocol calls supplementation mandatory; febrile neutropenia is more frequent without it.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'SAFE-INR-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"INR","max_age_days":7,"trigger_concept":"WARFARIN","trigger_window_days":90,"agents":["fluorouracil","capecitabine"]}'), t.guideline_ref = 'BC Cancer GIAJFFOX p1, GIGAVCOX p1',
  t.provenance_note = 'Applies only when warfarin appears on the medication record in the last 90 days.', t.severity = 'blocker', t.description = 'A patient on warfarin receiving fluorouracil or capecitabine has an INR within 7 days'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('SAFE-INR-001', 1, 'safety', 'medical_oncology', 'oncology', 3,
  'INR for fluoropyrimidine with warfarin',
  'A patient on warfarin receiving fluorouracil or capecitabine has an INR within 7 days',
  PARSE_JSON('{"concept":"INR","max_age_days":7,"trigger_concept":"WARFARIN","trigger_window_days":90,"agents":["fluorouracil","capecitabine"]}'),
  'BC Cancer GIAJFFOX p1, GIGAVCOX p1',
  'fluoropyrimidine regimens with warfarin on record', 'blocker',
  'Applies only when warfarin appears on the medication record in the last 90 days.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOSE-WT-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"concept":"WEIGHT","max_age":"REGIMEN_REGISTRY.cycle_days"}'), t.guideline_ref = 'BC Cancer BRAJTTW p4, BRAJTR p2',
  t.provenance_note = 'The protocols weigh the patient at the visit itself; before the visit SAARTHI can only confirm the last visit''s weight is on file.', t.severity = 'advisory', t.description = 'A body weight is on record within one cycle interval before the encounter'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOSE-WT-001', 1, 'clinical', 'medical_oncology', 'oncology', 2,
  'Weight current for dosing',
  'A body weight is on record within one cycle interval before the encounter',
  PARSE_JSON('{"concept":"WEIGHT","max_age":"REGIMEN_REGISTRY.cycle_days"}'),
  'BC Cancer BRAJTTW p4, BRAJTR p2',
  'all regimens', 'advisory',
  'The protocols weigh the patient at the visit itself; before the visit SAARTHI can only confirm the last visit''s weight is on file.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-CONSENT-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"doc_type":"chemo_consent","must_postdate":"current TREATMENT_PLAN.decided_at"}'), t.guideline_ref = 'AIIMS Jodhpur chemotherapy checklist (item 5); Samira Kohli v. Dr Prabha Manchanda (2008)',
  t.provenance_note = 'Treatment consent, not the data-sharing CONSENT in GOVERNANCE. A consent signed before the plan changed does not cover the new plan.', t.severity = 'blocker', t.description = 'A signed chemotherapy consent covering the current treatment plan is on file'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-CONSENT-001', 1, 'documentation', 'medical_oncology', 'oncology', 2,
  'Chemotherapy consent on file',
  'A signed chemotherapy consent covering the current treatment plan is on file',
  PARSE_JSON('{"doc_type":"chemo_consent","must_postdate":"current TREATMENT_PLAN.decided_at"}'),
  'AIIMS Jodhpur chemotherapy checklist (item 5); Samira Kohli v. Dr Prabha Manchanda (2008)',
  'all systemic therapy', 'blocker',
  'Treatment consent, not the data-sharing CONSENT in GOVERNANCE. A consent signed before the plan changed does not cover the new plan.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-MDT-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"decision_forum_in":["tumour_board","mdt"]}'), t.guideline_ref = 'NHA PM-JAY Health Benefit Package 2.2 manual p27 (section 3.9 Medical Oncology)',
  t.provenance_note = NULL, t.severity = 'blocker', t.description = 'The current treatment plan was decided by a tumour board or MDT'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-MDT-001', 1, 'documentation', 'medical_oncology', 'oncology', 2,
  'Tumour-board decision on record',
  'The current treatment plan was decided by a tumour board or MDT',
  PARSE_JSON('{"decision_forum_in":["tumour_board","mdt"]}'),
  'NHA PM-JAY Health Benefit Package 2.2 manual p27 (section 3.9 Medical Oncology)',
  'all oncology treatment plans', 'blocker',
  NULL);

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-ORDER-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"doc_type":"chemo_order","window":"REGIMEN_REGISTRY.cycle_days before the encounter"}'), t.guideline_ref = 'AIIMS Jodhpur chemotherapy checklist (item 1); ASCO/ONS administration safety standards',
  t.provenance_note = NULL, t.severity = 'blocker', t.description = 'A signed chemotherapy order dated within this cycle interval is on file'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-ORDER-001', 1, 'documentation', 'medical_oncology', 'oncology', 2,
  'Signed chemotherapy order for this cycle',
  'A signed chemotherapy order dated within this cycle interval is on file',
  PARSE_JSON('{"doc_type":"chemo_order","window":"REGIMEN_REGISTRY.cycle_days before the encounter"}'),
  'AIIMS Jodhpur chemotherapy checklist (item 1); ASCO/ONS administration safety standards',
  'all systemic therapy', 'blocker',
  NULL);

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-DISCH-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"doc_type":"discharge_summary","window_days":"2 x REGIMEN_REGISTRY.cycle_days","applies_if":"cycle_number > 1"}'), t.guideline_ref = 'AIIMS Jodhpur chemotherapy checklist (item 26)',
  t.provenance_note = 'Without it the next cycle''s blood tests are not ordered and the next visit fails.', t.severity = 'advisory', t.description = 'After cycle 1, a discharge summary from the previous cycle (next date and labs) is on file'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-DISCH-001', 1, 'documentation', 'medical_oncology', 'oncology', 1,
  'Last cycle''s discharge plan on file',
  'After cycle 1, a discharge summary from the previous cycle (next date and labs) is on file',
  PARSE_JSON('{"doc_type":"discharge_summary","window_days":"2 x REGIMEN_REGISTRY.cycle_days","applies_if":"cycle_number > 1"}'),
  'AIIMS Jodhpur chemotherapy checklist (item 26)',
  'cycles after the first', 'advisory',
  'Without it the next cycle''s blood tests are not ordered and the next visit fails.');

MERGE INTO SAARTHI.OPERATIONAL.RULE_CATALOG t
USING (SELECT 'DOC-ALLERGY-001' AS rule_id, 1 AS rule_version) s
ON t.rule_id = s.rule_id AND t.rule_version = s.rule_version
WHEN MATCHED THEN UPDATE SET t.threshold_json = PARSE_JSON('{"predicate":"allergy_history","verification_status":"verified"}'), t.guideline_ref = 'AIIMS Jodhpur chemotherapy checklist (item 3)',
  t.provenance_note = NULL, t.severity = 'advisory', t.description = 'A verified allergy history (including ''no known drug allergy'') is on record'
WHEN NOT MATCHED THEN INSERT (rule_id, rule_version, gate, specialty, disease_scope, specificity,
  display_name, description, threshold_json, guideline_ref, applies_to, severity, provenance_note)
VALUES ('DOC-ALLERGY-001', 1, 'documentation', 'medical_oncology', 'oncology', 1,
  'Allergy history recorded',
  'A verified allergy history (including ''no known drug allergy'') is on record',
  PARSE_JSON('{"predicate":"allergy_history","verification_status":"verified"}'),
  'AIIMS Jodhpur chemotherapy checklist (item 3)',
  'all systemic therapy', 'advisory',
  NULL);

-- Close the superseded v1 rows. Idempotent: only rows still open are touched.
UPDATE SAARTHI.OPERATIONAL.RULE_CATALOG
   SET effective_to = CURRENT_TIMESTAMP()
 WHERE rule_version = 1 AND effective_to IS NULL
   AND rule_id IN ('CLIN-ANC-001', 'CLIN-PLT-001', 'CLIN-CRCL-001', 'CLIN-BILI-001', 'SURV-LVEF-001');
