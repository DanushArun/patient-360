-- =============================================================================
-- STEP 14 - evaluate_gates (internal - never exposed to the agent)
-- =============================================================================
-- SPEC.md §4.4. The single source of truth for gate outcomes - R1: every
-- status, number, threshold comparison comes from this SQL, never the LLM.
-- A scheduled Task (step 16, TASK_REFRESH_READINESS) materialises the result
-- into READINESS_STATE; this procedure is what it calls.
--
-- This build implements THREE rule shapes:
--   (a) simple threshold - operator, value, unit, max_age_days in threshold_json.
--       Covers CLIN-ANC-001, CLIN-PLT-001, ENDO-HBA1C-001.
--   (b) freshness-only - concept + max_age_days but NO operator/value. Rule passes
--       if the event exists and is within max_age_days, fails otherwise. Covers
--       SURV-LVEF-001 and SURV-LVEF-002 (LVEF surveillance requires a recent
--       measurement; the rule does not gate on the absolute value).
--   (c) stratified (T-score bands) - bespoke evaluator for ENDO-DEXA-001. Bands
--       per NCCN v4.2024: T>=-1.0 -> 24-month interval; else -> 12-month interval.
--       QUS modality would surface as no T_SCORE row (different concept_id via
--       the ontology join), which the outer 'no evidence found' branch already
--       handles per SPEC.md 524.
-- Per-agent multi-value rules (CLIN-CRCL-001, CLIN-BILI-001), the HER2 state
-- machine (DOC-HER2-001), and presence/coverage/identity rules still need bespoke
-- evaluators - they remain in the fallback 'not_implemented' branch until the
-- next evaluator pass. A rule whose gate logic isn't implemented here returns
-- not_evaluated with an explicit reason, never a guessed pass/fail.
--
-- Every concept lookup below resolves concept_id via a CLINICAL_ONTOLOGY subquery
-- on canonical_name, never a literal UUID. ontology.sql mints a fresh UUID_STRING()
-- per account, so a hardcoded concept_id is a foreign key to nothing anywhere but
-- the account it was copied from - verified live: a prior version of this file
-- hardcoded 6 concept_ids from one account, and on a second account every one of
-- CLIN-CRCL-001, CLIN-BILI-001 and DOC-HER2-001 silently returned not_evaluated
-- ("missing") instead of reading the real data that was sitting right there.
--
-- Uses explicit CURSOR + OPEN/FETCH/CLOSE into scalar variables throughout,
-- not the FOR-loop record-variable form: dot-access on a FOR-loop record
-- (rec.field) inside plain scripting logic (LET/IF, outside an embedded SQL
-- statement) does not resolve reliably in this account's Snowflake Scripting
-- runtime - verified by direct testing, not assumed - so every field this
-- procedure needs is fetched into its own named variable instead.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.evaluate_gates(
    p_patient_id VARCHAR, p_encounter_id VARCHAR, p_known_as_of VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 procedure 10. R1: the single source of truth for gate outcomes. Not an agent tool.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_known_as_of TIMESTAMP_NTZ DEFAULT NULL;
    v_scheduled   TIMESTAMP_NTZ DEFAULT NULL;
    v_out         ARRAY DEFAULT ARRAY_CONSTRUCT();

    v_rule_id      VARCHAR;
    v_rule_version INTEGER;
    v_gate         VARCHAR;
    v_severity     VARCHAR;
    v_concept      VARCHAR;
    v_operator     VARCHAR;
    v_threshold    FLOAT;
    v_max_age_days FLOAT;

    v_evt_value    FLOAT;
    v_evt_id       VARCHAR;
    v_derivation   VARCHAR;
    v_age_days     FLOAT;

    v_outcome VARCHAR;
    v_reason  VARCHAR;
    v_found   BOOLEAN;

    v_has_plan       BOOLEAN;
    v_breast         BOOLEAN;
    v_scope_known    BOOLEAN;
    v_her2_targeted  BOOLEAN;
    v_surgical       BOOLEAN;

    -- Binds, in order: scope_known, surgical, breast, her2_targeted.
    c_rules CURSOR FOR
        SELECT rule_id, rule_version, gate, severity,
               threshold_json:concept::VARCHAR   AS concept,
               threshold_json:operator::VARCHAR  AS operator,
               threshold_json:value::FLOAT       AS threshold_value,
               threshold_json:max_age_days::FLOAT AS max_age_days
          FROM SAARTHI.OPERATIONAL.RULE_CATALOG
         WHERE threshold_json:concept IS NOT NULL     -- only the "simple threshold" shape
           AND (disease_scope IS NULL
                OR NOT ?
                OR (disease_scope = 'oncology' AND (rule_id <> 'SURG-CLEAR-001' OR ?))
                OR (disease_scope = 'breast_cancer' AND ?)
                OR (disease_scope = 'trastuzumab' AND ?))
         ORDER BY specificity DESC;
BEGIN
    v_known_as_of := COALESCE(TRY_TO_TIMESTAMP_NTZ(:p_known_as_of), CURRENT_TIMESTAMP());
    -- Freshness is measured against the encounter the evidence has to be fresh FOR.
    -- With no encounter, the only defensible anchor is the moment being asked
    -- about. A NULL anchor made every age NULL, every "age > max" comparison
    -- NULL, and every freshness rule fall through to its pass branch with a
    -- NULL reason - a silent pass on evidence of unknown age (R3), verified live.
    v_scheduled := COALESCE(
        (SELECT scheduled_time FROM SAARTHI.CORE.ENCOUNTER WHERE encounter_id = :p_encounter_id),
        v_known_as_of);

    -- Rule applicability, from RULE_CATALOG.disease_scope. A rule that does not
    -- apply is omitted, not reported not_evaluated: "LVEF not evaluated" on a
    -- FOLFOX patient is noise that trains clinicians to ignore the strip.
    -- When nothing about the patient's disease or regimen is on record, every
    -- rule applies - unknown scope is not the same as "does not apply" (R3).
    v_has_plan := (SELECT COUNT(*) > 0 FROM SAARTHI.CORE.TREATMENT_PLAN WHERE patient_id = :p_patient_id);
    v_breast := (SELECT COUNT(*) > 0 FROM SAARTHI.CORE.CLINICAL_EVENT
                  WHERE patient_id = :p_patient_id AND event_type = 'diagnosis' AND code LIKE 'C50%');
    v_scope_known := v_has_plan OR (SELECT COUNT(*) > 0 FROM SAARTHI.CORE.CLINICAL_EVENT
                  WHERE patient_id = :p_patient_id AND event_type = 'diagnosis');
    -- applies_to for SURV-LVEF-*: "trastuzumab and other HER2-targeted agents".
    -- Read from the most recent plan only - a superseded regimen no longer applies.
    v_her2_targeted := (SELECT COUNT(*) > 0 FROM (
        SELECT regimen_display FROM SAARTHI.CORE.TREATMENT_PLAN WHERE patient_id = :p_patient_id
         QUALIFY ROW_NUMBER() OVER (ORDER BY version DESC, decided_at DESC NULLS LAST) = 1) latest
        WHERE latest.regimen_display ILIKE ANY ('%trastuzumab%', '%pertuzumab%', '%T-DM1%', '%trastuzumab emtansine%'));
    -- applies_to for SURG-CLEAR-001: "patients with a surgical interruption
    -- mid-treatment". The structured proxy is a surgical note on record.
    v_surgical := (SELECT COUNT(*) > 0 FROM SAARTHI.DOCUMENTS.DOCUMENT
                    WHERE patient_id = :p_patient_id AND doc_type = 'surgical_note');

    OPEN c_rules USING (v_scope_known, v_surgical, v_breast, v_her2_targeted);
    FETCH c_rules INTO v_rule_id, v_rule_version, v_gate, v_severity, v_concept, v_operator, v_threshold, v_max_age_days;

    WHILE (v_rule_id IS NOT NULL) DO
        v_found := FALSE;
        v_evt_value := NULL;
        v_evt_id := NULL;
        v_derivation := NULL;
        v_age_days := NULL;

        SELECT he.value_num, he.event_id, he.derivation, DATEDIFF('day', he.event_time, :v_scheduled)
          INTO :v_evt_value, :v_evt_id, :v_derivation, :v_age_days
          FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS he
         WHERE he.patient_id = :p_patient_id
           AND he.concept_name = :v_concept
           AND he.ingested_at <= :v_known_as_of
         ORDER BY he.event_time DESC
         LIMIT 1;

        IF (v_evt_id IS NOT NULL) THEN
            v_found := TRUE;

            IF (v_rule_id = 'ENDO-DEXA-001') THEN
                -- Stratified T-score interval per NCCN v4.2024. T-score band
                -- determines the max age; freshness is compared against that band.
                -- v_evt_value carries the T-score from concept T_SCORE.
                IF (v_evt_value >= -1.0 AND v_age_days > 730) THEN
                    v_outcome := 'fail';
                    v_reason := 'DEXA T-score ' || v_evt_value::VARCHAR || ' (normal, T>=-1.0) - 24-month interval, last scan ' || v_age_days::VARCHAR || ' days old, overdue';
                ELSEIF (v_evt_value >= -1.0) THEN
                    v_outcome := 'pass';
                    v_reason := 'DEXA T-score ' || v_evt_value::VARCHAR || ' (normal, T>=-1.0) - 24-month interval, last scan ' || v_age_days::VARCHAR || ' days old, within interval';
                ELSEIF (v_evt_value > -2.5 AND v_age_days > 365) THEN
                    v_outcome := 'fail';
                    v_reason := 'DEXA T-score ' || v_evt_value::VARCHAR || ' (osteopenia, -2.5<T<-1.0) - 12-month interval per NCCN, last scan ' || v_age_days::VARCHAR || ' days old, overdue';
                ELSEIF (v_evt_value > -2.5) THEN
                    v_outcome := 'pass';
                    v_reason := 'DEXA T-score ' || v_evt_value::VARCHAR || ' (osteopenia, -2.5<T<-1.0) - 12-month interval per NCCN, last scan ' || v_age_days::VARCHAR || ' days old, within interval';
                ELSEIF (v_age_days > 365) THEN
                    v_outcome := 'fail';
                    v_reason := 'DEXA T-score ' || v_evt_value::VARCHAR || ' (osteoporosis, T<=-2.5) - 12-month interval, last scan ' || v_age_days::VARCHAR || ' days old, overdue';
                ELSE
                    v_outcome := 'pass';
                    v_reason := 'DEXA T-score ' || v_evt_value::VARCHAR || ' (osteoporosis, T<=-2.5) - 12-month interval, last scan ' || v_age_days::VARCHAR || ' days old, within interval';
                END IF;
            ELSEIF (v_operator IS NULL AND v_max_age_days IS NOT NULL) THEN
                -- Freshness-only shape (SURV-LVEF-001/002). No threshold on the
                -- value - the rule requires a recent measurement, not a target
                -- value. Pass if within max_age_days; fail otherwise.
                IF (v_age_days > v_max_age_days) THEN
                    v_outcome := 'fail';
                    v_reason := v_concept || ' last measured ' || v_age_days::VARCHAR || ' days ago, exceeds ' || v_max_age_days::VARCHAR || '-day surveillance interval';
                ELSE
                    v_outcome := 'pass';
                    v_reason := v_concept || ' measured ' || v_age_days::VARCHAR || ' days ago, within ' || v_max_age_days::VARCHAR || '-day surveillance interval';
                END IF;
            ELSEIF (v_operator IS NULL) THEN
                -- Rules with a shape this evaluator does not implement yet
                -- (per-agent multi-value, presence/coverage/identity, HER2 state
                -- machine). Evidence exists but the logic to read it does not -
                -- say so explicitly, never go silent.
                v_outcome := 'not_evaluated';
                v_reason := 'evidence exists but this rule''s threshold shape is not yet implemented by evaluate_gates';
            ELSEIF (v_max_age_days IS NOT NULL AND v_age_days > v_max_age_days) THEN
                v_outcome := 'fail';
                v_reason := v_concept || ' assessment is ' || v_age_days::VARCHAR || ' days old, exceeds ' || v_max_age_days::VARCHAR || '-day limit';
            ELSEIF (v_operator = '>=' AND v_evt_value >= v_threshold) THEN
                v_outcome := 'pass';
                v_reason := v_concept || ' is ' || v_evt_value::VARCHAR || ', meets threshold ' || v_threshold::VARCHAR;
            ELSEIF (v_operator = '>=' AND v_evt_value < v_threshold) THEN
                v_outcome := 'fail';
                v_reason := v_concept || ' is ' || v_evt_value::VARCHAR || ', below threshold ' || v_threshold::VARCHAR;
            ELSEIF (v_operator = '<' AND v_evt_value < v_threshold) THEN
                v_outcome := 'pass';
                v_reason := v_concept || ' is ' || v_evt_value::VARCHAR || ', within threshold ' || v_threshold::VARCHAR;
            ELSEIF (v_operator = '<' AND v_evt_value >= v_threshold) THEN
                v_outcome := 'fail';
                v_reason := v_concept || ' is ' || v_evt_value::VARCHAR || ', at or above threshold ' || v_threshold::VARCHAR;
            ELSE
                v_outcome := 'not_evaluated';
                v_reason := 'unrecognised operator ' || v_operator;
            END IF;

            v_out := ARRAY_APPEND(v_out, OBJECT_CONSTRUCT(
                'gate', v_gate, 'rule_id', v_rule_id, 'rule_version', v_rule_version,
                'outcome', v_outcome, 'severity', v_severity, 'reason', v_reason,
                'evidence_ids', ARRAY_CONSTRUCT(v_evt_id), 'derived', v_derivation,
                'known_as_of', TO_VARCHAR(v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS')));
        ELSE
            v_out := ARRAY_APPEND(v_out, OBJECT_CONSTRUCT(
                'gate', v_gate, 'rule_id', v_rule_id, 'rule_version', v_rule_version,
                'outcome', 'not_evaluated', 'severity', v_severity,
                'reason', 'no ' || v_concept || ' evidence found as of ' || TO_VARCHAR(v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'evidence_ids', ARRAY_CONSTRUCT(),
                'known_as_of', TO_VARCHAR(v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS')));
        END IF;

        FETCH c_rules INTO v_rule_id, v_rule_version, v_gate, v_severity, v_concept, v_operator, v_threshold, v_max_age_days;
    END WHILE;
    CLOSE c_rules;

    -- =========================================================================
    -- Second pass: rules WITHOUT threshold_json.concept - dispatched by rule_id.
    -- Covers identity (ID-LINK-001, ID-QUAR-001), coverage (COV-AUTH-001,
    -- COV-LIMIT-001), documentation (DOC-PATH-001, DOC-DISC-001, DOC-HER2-001),
    -- surgical clearance (SURG-CLEAR-001), and per-agent multi-input clinical
    -- (CLIN-CRCL-001, CLIN-BILI-001). Rules for which required inputs are not
    -- seeded return not_evaluated with a specific reason naming the missing
    -- inputs - never a silent skip and never a guessed pass/fail.
    -- =========================================================================
    LET c_special CURSOR FOR
        SELECT rule_id, rule_version, gate, severity
          FROM SAARTHI.OPERATIONAL.RULE_CATALOG
         WHERE threshold_json:concept IS NULL
           AND (disease_scope IS NULL
                OR NOT ?
                OR (disease_scope = 'oncology' AND (rule_id <> 'SURG-CLEAR-001' OR ?))
                OR (disease_scope = 'breast_cancer' AND ?)
                OR (disease_scope = 'trastuzumab' AND ?))
         ORDER BY specificity DESC;

    OPEN c_special USING (v_scope_known, v_surgical, v_breast, v_her2_targeted);
    FETCH c_special INTO v_rule_id, v_rule_version, v_gate, v_severity;

    WHILE (v_rule_id IS NOT NULL) DO
        v_outcome := 'not_evaluated';
        v_reason  := 'evaluator not implemented';

        IF (v_rule_id = 'ID-LINK-001') THEN
            LET v_linked NUMBER := (SELECT COUNT(*) FROM SAARTHI.CORE.ID_MAP WHERE patient_id = :p_patient_id AND link_status IN ('abha_linked','manually_verified'));
            IF (v_linked >= 1) THEN
                v_outcome := 'pass';
                v_reason  := v_linked::VARCHAR || ' verified identifier link(s) present (abha_linked or manually_verified)';
            ELSE
                v_outcome := 'fail';
                v_reason  := 'no verified identifier links on file - abha_linked or manually_verified required';
            END IF;
        ELSEIF (v_rule_id = 'ID-QUAR-001') THEN
            LET v_quar NUMBER := (SELECT COUNT(*) FROM SAARTHI.CORE.ID_MAP WHERE patient_id = :p_patient_id AND link_status = 'quarantined');
            IF (v_quar = 0) THEN
                v_outcome := 'pass';
                v_reason  := 'no quarantined identity matches on record';
            ELSE
                v_outcome := 'fail';
                v_reason  := v_quar::VARCHAR || ' quarantined identity match(es) - manual reconciliation required, no evidence contributes until resolved (R4)';
            END IF;
        ELSEIF (v_rule_id = 'DOC-PATH-001') THEN
            LET v_final_path NUMBER := (SELECT COUNT(*) FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND event_type = 'pathology' AND status = 'final');
            LET v_pending_path NUMBER := (SELECT COUNT(*) FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND event_type = 'pathology' AND status IN ('preliminary','pending'));
            IF (v_final_path >= 1) THEN
                v_outcome := 'pass';
                v_reason  := v_final_path::VARCHAR || ' pathology report(s) in final status';
            ELSEIF (v_pending_path >= 1) THEN
                v_outcome := 'not_evaluated';
                v_reason  := v_pending_path::VARCHAR || ' pathology report(s) preliminary/pending - awaiting final';
            ELSE
                v_outcome := 'fail';
                v_reason  := 'no pathology reports on record';
            END IF;
        ELSEIF (v_rule_id = 'DOC-DISC-001') THEN
            -- discordant_across_specimens is not a failure - both readings surface
            -- as evidence, and a human reconciles per SPEC §12. Only same-specimen
            -- disagreement is a real conflict. This evaluator checks HER2 as the
            -- canonical case; a fuller sweep would enumerate every concept.
            LET v_her2_specimens NUMBER := (SELECT COUNT(DISTINCT specimen_id) FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'HER2_IHC') AND specimen_id IS NOT NULL);
            IF (v_her2_specimens > 1) THEN
                v_outcome := 'pass';
                v_reason  := 'HER2 read on ' || v_her2_specimens::VARCHAR || ' distinct specimens - discordant_across_specimens: both readings surfaced, never auto-resolved';
            ELSE
                v_outcome := 'pass';
                v_reason  := 'no cross-source discordance detected';
            END IF;
        ELSEIF (v_rule_id = 'DOC-HER2-001') THEN
            -- HER2 state machine: ihc IN (0,1,3) -> final; ihc=2 -> FISH reflex.
            -- Latest specimen is authoritative when specimens differ (final resection
            -- outranks outside biopsy in real practice). value_text pattern is like
            -- 'grade=III ihc=2+'.
            LET v_latest_ihc VARCHAR := (SELECT value_text FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'HER2_IHC') ORDER BY event_time DESC LIMIT 1);
            IF (v_latest_ihc IS NULL) THEN
                v_outcome := 'fail';
                v_reason  := 'no HER2 IHC recorded';
            ELSEIF (v_latest_ihc ILIKE '%ihc=2%' OR v_latest_ihc ILIKE '%ihc 2%') THEN
                -- IHC 2+ is equivocal: status is final only once a FISH result on
                -- or after that IHC exists. ASCO/CAP 2018 dual-probe groups:
                --   group 1  ratio >= 2.0 AND mean HER2 copies >= 4.0  -> positive
                --   group 5  ratio <  2.0 AND copies < 4.0             -> negative
                --   groups 2-4 (discordant ratio/copies)               -> needs
                --            concurrent IHC review; not final, never guessed.
                -- value_text carries 'ratio=2.6 copies=5.8'.
                LET v_ihc_time TIMESTAMP_NTZ := (SELECT MAX(event_time) FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'HER2_IHC'));
                LET v_fish VARCHAR := (SELECT value_text FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND status = 'final' AND event_time >= :v_ihc_time AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'HER2_FISH') ORDER BY event_time DESC LIMIT 1);
                LET v_ratio  FLOAT := TRY_TO_DOUBLE(REGEXP_SUBSTR(:v_fish, 'ratio=([0-9.]+)', 1, 1, 'e', 1));
                LET v_copies FLOAT := TRY_TO_DOUBLE(REGEXP_SUBSTR(:v_fish, 'copies=([0-9.]+)', 1, 1, 'e', 1));
                IF (v_fish IS NULL) THEN
                    v_outcome := 'not_evaluated';
                    v_reason  := 'HER2 IHC=2 on latest specimen (' || v_latest_ihc || ') - FISH reflex required, no FISH result on record yet';
                ELSEIF (v_ratio IS NULL OR v_copies IS NULL) THEN
                    v_outcome := 'not_evaluated';
                    v_reason  := 'FISH result on record but ratio/copy number unreadable (' || v_fish || ') - manual review';
                ELSEIF (v_ratio >= 2.0 AND v_copies >= 4.0) THEN
                    v_outcome := 'pass';
                    v_reason  := 'HER2 status final: IHC 2+ reflexed to FISH, amplified (ratio ' || v_ratio::VARCHAR || ', ' || v_copies::VARCHAR || ' copies/cell - ASCO/CAP 2018 group 1, positive)';
                ELSEIF (v_ratio < 2.0 AND v_copies < 4.0) THEN
                    v_outcome := 'pass';
                    v_reason  := 'HER2 status final: IHC 2+ reflexed to FISH, not amplified (ratio ' || v_ratio::VARCHAR || ', ' || v_copies::VARCHAR || ' copies/cell - ASCO/CAP 2018 group 5, negative)';
                ELSE
                    v_outcome := 'not_evaluated';
                    v_reason  := 'FISH ratio ' || v_ratio::VARCHAR || ' with ' || v_copies::VARCHAR || ' copies/cell is ASCO/CAP 2018 group 2-4 - concurrent IHC review required, not final';
                END IF;
            ELSE
                v_outcome := 'pass';
                v_reason  := 'HER2 status final from IHC alone: ' || v_latest_ihc;
            END IF;
        ELSEIF (v_rule_id = 'COV-LIMIT-001') THEN
            LET v_cov_used FLOAT := (SELECT used_amount FROM SAARTHI.CORE.COVERAGE WHERE patient_id = :p_patient_id ORDER BY priority ASC NULLS LAST LIMIT 1);
            LET v_cov_limit FLOAT := (SELECT annual_limit FROM SAARTHI.CORE.COVERAGE WHERE patient_id = :p_patient_id ORDER BY priority ASC NULLS LAST LIMIT 1);
            IF (v_cov_limit IS NULL) THEN
                v_outcome := 'not_evaluated';
                v_reason  := 'no COVERAGE row on file for patient';
            ELSEIF (v_cov_used < v_cov_limit) THEN
                v_outcome := 'pass';
                v_reason  := 'used ' || v_cov_used::VARCHAR || ' of annual limit ' || v_cov_limit::VARCHAR || ' - within limit (family-floater aggregation OOS per SPEC 175)';
            ELSE
                v_outcome := 'fail';
                v_reason  := 'used ' || v_cov_used::VARCHAR || ' meets or exceeds annual limit ' || v_cov_limit::VARCHAR;
            END IF;
        ELSEIF (v_rule_id = 'COV-AUTH-001') THEN
            LET v_pa_status VARCHAR := (SELECT status FROM SAARTHI.CORE.PRE_AUTHORIZATION WHERE patient_id = :p_patient_id AND (encounter_id = :p_encounter_id OR encounter_id IS NULL) AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP()) ORDER BY decided_at DESC NULLS LAST, requested_at DESC NULLS LAST LIMIT 1);
            LET v_pa_letter VARCHAR := (SELECT letter_status FROM SAARTHI.CORE.PRE_AUTHORIZATION WHERE patient_id = :p_patient_id AND (encounter_id = :p_encounter_id OR encounter_id IS NULL) AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP()) ORDER BY decided_at DESC NULLS LAST, requested_at DESC NULLS LAST LIMIT 1);
            IF (v_pa_status IS NULL) THEN
                v_outcome := 'not_evaluated';
                v_reason  := 'no pre-authorisation record for this patient/encounter';
            ELSEIF (v_pa_letter IS NOT NULL AND v_pa_letter != v_pa_status) THEN
                v_outcome := 'conflicting';
                v_reason  := 'pre-auth table status is ''' || v_pa_status || ''' but letter says ''' || v_pa_letter || ''' - human reconciliation required';
            ELSEIF (v_pa_status = 'approved') THEN
                v_outcome := 'pass';
                v_reason  := 'pre-authorisation approved and current';
            ELSEIF (v_pa_status = 'pending') THEN
                v_outcome := 'not_evaluated';
                v_reason  := 'pre-authorisation status is pending - decision not yet issued';
            ELSEIF (v_pa_status = 'expired') THEN
                v_outcome := 'fail';
                v_reason  := 'pre-authorisation expired - renewal required';
            ELSE
                v_outcome := 'fail';
                v_reason  := 'pre-authorisation status: ' || v_pa_status;
            END IF;
        ELSEIF (v_rule_id = 'CLIN-CRCL-001') THEN
            -- Cockcroft-Gault: CrCl = ((140 - age) * weight_kg * (0.85 if female else 1)) / (72 * creatinine)
            LET v_creat  FLOAT := (SELECT value_num FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'CREATININE') AND status = 'final' ORDER BY event_time DESC LIMIT 1);
            LET v_weight FLOAT := (SELECT value_num FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'WEIGHT') AND status = 'final' ORDER BY event_time DESC LIMIT 1);
            LET v_age    FLOAT := (SELECT DATEDIFF('year', dob, CURRENT_DATE()) FROM SAARTHI.CORE.PATIENT WHERE patient_id = :p_patient_id);
            LET v_female BOOLEAN := (SELECT gender = 'female' FROM SAARTHI.CORE.PATIENT WHERE patient_id = :p_patient_id);
            IF (v_creat IS NULL OR v_weight IS NULL OR v_age IS NULL) THEN
                v_outcome := 'not_evaluated';
                v_reason  := 'CrCl requires creatinine + weight + age; missing: ' ||
                             IFF(v_creat IS NULL, 'creatinine ', '') ||
                             IFF(v_weight IS NULL, 'weight ', '') ||
                             IFF(v_age IS NULL, 'age ', '');
            ELSE
                LET v_crcl FLOAT := ((140 - v_age) * v_weight * IFF(v_female, 0.85, 1.0)) / (72 * v_creat);
                -- Safest-agent threshold (60 mL/min - cisplatin/methotrexate). If CrCl
                -- clears the strictest threshold, all listed agents are covered.
                IF (v_crcl >= 60) THEN
                    v_outcome := 'pass';
                    v_reason  := 'CrCl ' || ROUND(v_crcl,1)::VARCHAR || ' mL/min (Cockcroft-Gault, age=' || v_age::VARCHAR || ' weight=' || v_weight::VARCHAR || ' cr=' || v_creat::VARCHAR || ') - clears strictest per-agent minimum (60 for cisplatin)';
                ELSEIF (v_crcl >= 45) THEN
                    v_outcome := 'pass';
                    v_reason  := 'CrCl ' || ROUND(v_crcl,1)::VARCHAR || ' mL/min - meets pemetrexed/mid-tier thresholds, below cisplatin 60 minimum';
                ELSEIF (v_crcl >= 30) THEN
                    v_outcome := 'pass';
                    v_reason  := 'CrCl ' || ROUND(v_crcl,1)::VARCHAR || ' mL/min - meets carboplatin/capecitabine 30 minimum only';
                ELSE
                    v_outcome := 'fail';
                    v_reason  := 'CrCl ' || ROUND(v_crcl,1)::VARCHAR || ' mL/min - below any listed per-agent minimum (30-60 range)';
                END IF;
            END IF;
        ELSEIF (v_rule_id = 'CLIN-BILI-001') THEN
            -- Per-agent bilirubin thresholds. Uses doxorubicin (bilirubin<=1.2 mg/dL)
            -- as the safety-first default because it is the strictest absolute limit
            -- across the three agents named in the rule (docetaxel is x-ULN; doxorubicin
            -- is absolute mg/dL). AST also read for informational context.
            LET v_bili FLOAT := (SELECT value_num FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'BILIRUBIN') AND status = 'final' ORDER BY event_time DESC LIMIT 1);
            LET v_ast  FLOAT := (SELECT value_num FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id = :p_patient_id AND concept_id = (SELECT concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name = 'AST') AND status = 'final' ORDER BY event_time DESC LIMIT 1);
            IF (v_bili IS NULL) THEN
                v_outcome := 'not_evaluated';
                v_reason  := 'per-agent bilirubin rule requires a bilirubin measurement';
            ELSEIF (v_bili <= 1.2) THEN
                v_outcome := 'pass';
                v_reason  := 'bilirubin ' || v_bili::VARCHAR || ' mg/dL clears strictest per-agent absolute (doxorubicin <=1.2)' || IFF(v_ast IS NOT NULL, ', AST ' || v_ast::VARCHAR || ' U/L for context', '');
            ELSEIF (v_bili <= 1.8) THEN
                v_outcome := 'pass';
                v_reason  := 'bilirubin ' || v_bili::VARCHAR || ' mg/dL within 1.5x ULN band (paclitaxel/docetaxel-eligible; doxorubicin threshold exceeded)';
            ELSE
                v_outcome := 'fail';
                v_reason  := 'bilirubin ' || v_bili::VARCHAR || ' mg/dL exceeds any listed per-agent threshold - hold hepatobiliary-clearance chemo';
            END IF;
        ELSEIF (v_rule_id = 'SURG-CLEAR-001') THEN
            -- Requires three assertions: wound_healing_status IN (adequate, healed),
            -- infection_status = resolved, surgical_clearance_signed_by_practitioner IS NOT NULL.
            LET v_wound VARCHAR := (SELECT value FROM SAARTHI.EVIDENCE.ASSERTION WHERE subject = :p_patient_id AND predicate = 'wound_healing_status' AND verification_status = 'verified' ORDER BY assertion_id DESC LIMIT 1);
            LET v_infect VARCHAR := (SELECT value FROM SAARTHI.EVIDENCE.ASSERTION WHERE subject = :p_patient_id AND predicate = 'infection_status' AND verification_status = 'verified' ORDER BY assertion_id DESC LIMIT 1);
            LET v_signed VARCHAR := (SELECT value FROM SAARTHI.EVIDENCE.ASSERTION WHERE subject = :p_patient_id AND predicate = 'surgical_clearance_signed_by_practitioner' AND verification_status = 'verified' ORDER BY assertion_id DESC LIMIT 1);
            IF (v_wound IS NULL OR v_infect IS NULL OR v_signed IS NULL) THEN
                v_outcome := 'not_evaluated';
                v_reason  := 'surgical clearance requires three verified assertions; missing: ' ||
                             IFF(v_wound IS NULL, 'wound_healing_status ', '') ||
                             IFF(v_infect IS NULL, 'infection_status ', '') ||
                             IFF(v_signed IS NULL, 'clearance_signature ', '');
            ELSEIF (v_wound NOT IN ('adequate','healed')) THEN
                v_outcome := 'fail';
                v_reason  := 'wound_healing_status is ''' || v_wound || ''' - required: adequate or healed';
            ELSEIF (v_infect != 'resolved') THEN
                v_outcome := 'fail';
                v_reason  := 'infection_status is ''' || v_infect || ''' - required: resolved';
            ELSE
                v_outcome := 'pass';
                v_reason  := 'surgical clearance verified: wound=' || v_wound || ', infection=' || v_infect || ', signed by ' || v_signed;
            END IF;
        ELSEIF (v_rule_id = 'SURV-LVEF-002') THEN
            -- Delta rule: hold if (baseline - current) >= 16, OR (current < 50 AND drop >= 10).
            -- Needs at least two LVEF measurements to compute a delta.
            LET v_lvef_readings NUMBER := (SELECT COUNT(*) FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS WHERE patient_id = :p_patient_id AND concept_name = 'LVEF');
            IF (v_lvef_readings < 2) THEN
                v_outcome := 'not_evaluated';
                v_reason  := 'delta rule requires baseline + current LVEF, only ' || v_lvef_readings::VARCHAR || ' measurement(s) on record';
            ELSE
                LET v_baseline FLOAT := (SELECT value_num FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS WHERE patient_id = :p_patient_id AND concept_name = 'LVEF' ORDER BY event_time ASC LIMIT 1);
                LET v_current  FLOAT := (SELECT value_num FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS WHERE patient_id = :p_patient_id AND concept_name = 'LVEF' ORDER BY event_time DESC LIMIT 1);
                LET v_drop FLOAT := v_baseline - v_current;
                IF (v_drop >= 16) THEN
                    v_outcome := 'fail';
                    v_reason  := 'LVEF dropped ' || v_drop::VARCHAR || 'pp from baseline (' || v_baseline::VARCHAR || ' -> ' || v_current::VARCHAR || ') - hold trastuzumab (>= 16pp threshold)';
                ELSEIF (v_current < 50 AND v_drop >= 10) THEN
                    v_outcome := 'fail';
                    v_reason  := 'LVEF ' || v_current::VARCHAR || ' below 50 AND dropped ' || v_drop::VARCHAR || 'pp from baseline (>=10pp threshold when current<50) - hold trastuzumab';
                ELSE
                    v_outcome := 'pass';
                    v_reason  := 'LVEF ' || v_current::VARCHAR || ' vs baseline ' || v_baseline::VARCHAR || ' (drop ' || v_drop::VARCHAR || 'pp) - within thresholds, continue';
                END IF;
            END IF;
        ELSE
            v_outcome := 'not_evaluated';
            v_reason  := 'rule ' || v_rule_id || ' has no evaluator dispatch';
        END IF;

        v_out := ARRAY_APPEND(v_out, OBJECT_CONSTRUCT(
            'gate', v_gate, 'rule_id', v_rule_id, 'rule_version', v_rule_version,
            'outcome', v_outcome, 'severity', v_severity, 'reason', v_reason,
            'evidence_ids', ARRAY_CONSTRUCT(),
            'known_as_of', TO_VARCHAR(v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS')));

        FETCH c_special INTO v_rule_id, v_rule_version, v_gate, v_severity;
    END WHILE;
    CLOSE c_special;

    RETURN OBJECT_CONSTRUCT('patient_id', p_patient_id, 'encounter_id', p_encounter_id, 'gates', v_out);
END;
$$;
