-- =============================================================================
-- STEP 16b - TASK refresh_readiness
-- =============================================================================
-- SPEC.md §4.4. Materialises evaluate_gates output into READINESS_STATE on a
-- schedule so downstream views (review queue DT, patient timeline, agent
-- responses) can read a single point-in-time snapshot per encounter rather
-- than re-invoking the evaluator per query. R1 preserved: this task WRITES
-- the SQL rule outcomes; it never asks an LLM to decide.
--
-- Idempotency: each run replaces each encounter's snapshot in one transaction
-- (DELETE + INSERT), so repeat runs never duplicate and never leave stale rows.
--
-- Scope: every encounter with a scheduled_time - the deep case's history and
-- the day-care cohort's upcoming visits (data/load_daycare_cohort.sql). The
-- coordinator's home screen reads this table, never the evaluator directly.

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.refresh_readiness_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Task body for refresh_readiness. Calls evaluate_gates per encounter and replaces its READINESS_STATE snapshot.'
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

        -- Replace this encounter's snapshot, not upsert into it. An upsert keyed
        -- on rule_version left the superseded v1 row next to its v2 successor,
        -- and left behind rows for gates that no longer apply (neutrophils for
        -- a patient moved to trastuzumab alone). One transaction per encounter,
        -- so a reader never sees the snapshot half-written.
        BEGIN TRANSACTION;
        DELETE FROM SAARTHI.OPERATIONAL.READINESS_STATE WHERE encounter_id = :v_encounter_id;
        INSERT INTO SAARTHI.OPERATIONAL.READINESS_STATE (
            patient_id, encounter_id, gate, rule_id, rule_version,
            outcome, severity, reason, evidence_ids, known_as_of, computed_at)
        SELECT :v_patient_id, :v_encounter_id,
               g.value:gate::VARCHAR, g.value:rule_id::VARCHAR, g.value:rule_version::INTEGER,
               g.value:outcome::VARCHAR, g.value:severity::VARCHAR, g.value:reason::VARCHAR,
               g.value:evidence_ids, TRY_TO_TIMESTAMP_NTZ(g.value:known_as_of::VARCHAR), CURRENT_TIMESTAMP()
          FROM TABLE(FLATTEN(input => :v_gates_response:gates)) g;
        COMMIT;
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
