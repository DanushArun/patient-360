-- =============================================================================
-- STEP 14 - evaluate_gates (internal - never exposed to the agent)
-- =============================================================================
-- SPEC.md §4.4. The single source of truth for gate outcomes - R1: every
-- status, number, threshold comparison comes from this SQL, never the LLM.
-- A scheduled Task (step 16, TASK_REFRESH_READINESS) materialises the result
-- into READINESS_STATE; this procedure is what it calls.
--
-- This build implements the "simple threshold" rule shape (operator, value,
-- unit, max_age_days in threshold_json) - covers CLIN-ANC-001, CLIN-PLT-001,
-- SURV-LVEF-001, ENDO-HBA1C-001. Per-agent multi-value rules (CLIN-CRCL-001,
-- CLIN-BILI-001), the HER2 state machine (DOC-HER2-001), and the stratified
-- DEXA rule (ENDO-DEXA-001) need bespoke evaluators, not yet written - a
-- rule whose gate logic isn't implemented here returns not_evaluated with an
-- explicit reason, never a guessed pass/fail.
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

    c_rules CURSOR FOR
        SELECT rule_id, rule_version, gate, severity,
               threshold_json:concept::VARCHAR   AS concept,
               threshold_json:operator::VARCHAR  AS operator,
               threshold_json:value::FLOAT       AS threshold_value,
               threshold_json:max_age_days::FLOAT AS max_age_days
          FROM SAARTHI.OPERATIONAL.RULE_CATALOG
         WHERE threshold_json:concept IS NOT NULL     -- only the "simple threshold" shape
         ORDER BY specificity DESC;
BEGIN
    v_known_as_of := COALESCE(TRY_TO_TIMESTAMP_NTZ(:p_known_as_of), CURRENT_TIMESTAMP());
    v_scheduled := (SELECT scheduled_time FROM SAARTHI.CORE.ENCOUNTER WHERE encounter_id = :p_encounter_id);

    OPEN c_rules;
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

            IF (v_operator IS NULL) THEN
                -- Rules with a shape this evaluator does not implement yet
                -- (e.g. ENDO-DEXA-001's stratified T-score bands) have no
                -- flat operator/value pair. Evidence exists but the logic to
                -- read it does not - say so explicitly, never go silent.
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

    RETURN OBJECT_CONSTRUCT('patient_id', p_patient_id, 'encounter_id', p_encounter_id, 'gates', v_out);
END;
$$;
