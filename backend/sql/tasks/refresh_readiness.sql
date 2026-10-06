-- =============================================================================
-- STEP 16b - TASK refresh_readiness
-- =============================================================================
-- SPEC.md §4.4. Materialises evaluate_gates output into READINESS_STATE on a
-- schedule so downstream views (review queue DT, patient timeline, agent
-- responses) can read a single point-in-time snapshot per encounter rather
-- than re-invoking the evaluator per query. R1 preserved: this task WRITES
-- the SQL rule outcomes; it never asks an LLM to decide.
--
-- Idempotency: MERGE keyed on (patient_id, encounter_id, rule_id, rule_version)
-- with UPDATE-on-match so repeat runs update rather than duplicate; then rows for rules the
-- evaluator no longer returns are deleted, so the table is the current snapshot (6 Oct 2026).
--
-- Scope: every encounter with a scheduled_time - the deep case's history and
-- the day-care cohort's upcoming visits (data/load_daycare_cohort.sql). The
-- coordinator's home screen reads this table, never the evaluator directly.

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.refresh_readiness_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Task body for refresh_readiness. Calls evaluate_gates per encounter and MERGEs into READINESS_STATE.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_rows_written INTEGER DEFAULT 0;
    v_patient_id VARCHAR;
    v_encounter_id VARCHAR;
    v_gates_response VARIANT;
    c_encounters CURSOR FOR
        SELECT DISTINCT e.patient_id, e.encounter_id
          FROM SAARTHI.CORE.ENCOUNTER e
         WHERE e.scheduled_time IS NOT NULL
         ORDER BY e.patient_id, e.encounter_id;
BEGIN
    OPEN c_encounters;
    FETCH c_encounters INTO v_patient_id, v_encounter_id;

    WHILE (v_patient_id IS NOT NULL) DO
        v_gates_response := (
            CALL SAARTHI.OPERATIONAL.evaluate_gates(:v_patient_id, :v_encounter_id, NULL)
        );

        MERGE INTO SAARTHI.OPERATIONAL.READINESS_STATE t
        USING (
            SELECT :v_patient_id AS patient_id,
                   :v_encounter_id AS encounter_id,
                   g.value:gate::VARCHAR         AS gate,
                   g.value:rule_id::VARCHAR      AS rule_id,
                   g.value:rule_version::INTEGER AS rule_version,
                   g.value:outcome::VARCHAR      AS outcome,
                   g.value:severity::VARCHAR     AS severity,
                   g.value:reason::VARCHAR       AS reason,
                   g.value:evidence_ids          AS evidence_ids,
                   TRY_TO_TIMESTAMP_NTZ(g.value:known_as_of::VARCHAR) AS known_as_of
              FROM TABLE(FLATTEN(input => :v_gates_response:gates)) g
        ) s
        ON t.patient_id = s.patient_id
           AND t.encounter_id = s.encounter_id
           AND t.rule_id = s.rule_id
           AND t.rule_version = s.rule_version
        WHEN MATCHED THEN UPDATE SET
            t.gate = s.gate,
            t.outcome = s.outcome,
            t.severity = s.severity,
            t.reason = s.reason,
            t.evidence_ids = s.evidence_ids,
            t.known_as_of = s.known_as_of,
            t.computed_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            patient_id, encounter_id, gate, rule_id, rule_version,
            outcome, severity, reason, evidence_ids, known_as_of, computed_at
        ) VALUES (
            s.patient_id, s.encounter_id, s.gate, s.rule_id, s.rule_version,
            s.outcome, s.severity, s.reason, s.evidence_ids, s.known_as_of, CURRENT_TIMESTAMP()
        );

        -- Snapshot, not history: drop rules the evaluator no longer returns for this encounter
        -- (e.g. a rule version rescoped away). Skipped when the evaluation failed, so an error can
        -- never erase readiness. NOT IN over a NULL key matches nothing: also fails closed.
        IF (v_gates_response:error IS NULL AND ARRAY_SIZE(v_gates_response:gates) > 0) THEN
            DELETE FROM SAARTHI.OPERATIONAL.READINESS_STATE
             WHERE patient_id = :v_patient_id
               AND encounter_id = :v_encounter_id
               AND rule_id || ':' || rule_version::VARCHAR NOT IN (
                   SELECT g.value:rule_id::VARCHAR || ':' || g.value:rule_version::INTEGER::VARCHAR
                     FROM TABLE(FLATTEN(input => :v_gates_response:gates)) g);
        END IF;

        v_rows_written := v_rows_written + (SELECT COUNT(*)
            FROM TABLE(FLATTEN(input => :v_gates_response:gates)));

        FETCH c_encounters INTO v_patient_id, v_encounter_id;
    END WHILE;
    CLOSE c_encounters;

    RETURN OBJECT_CONSTRUCT(
        'rows_written', v_rows_written,
        'refreshed_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );
END;
$$;

CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_REFRESH_READINESS
  WAREHOUSE = SAARTHI_AI_WH
  SCHEDULE = '5 MINUTE'
AS
  CALL SAARTHI.OPERATIONAL.refresh_readiness_proc();

-- Materialise once at deploy so the day-care list is populated immediately.
-- The task is left SUSPENDED (Snowflake's default on create): a 5-minute
-- schedule on a live warehouse costs credits around the clock. For live
-- operation: ALTER TASK SAARTHI.OPERATIONAL.TASK_REFRESH_READINESS RESUME;
CALL SAARTHI.OPERATIONAL.refresh_readiness_proc();
