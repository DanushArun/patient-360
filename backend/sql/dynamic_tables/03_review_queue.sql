-- =============================================================================
-- STEP 15b - DT review_queue (coordinator dashboard source)
-- =============================================================================
-- Materialises the coordinator's Review Queue. Sources: READINESS_STATE for
-- gate failures and unevaluable states, REVIEW_TASK for explicit human-review
-- items filed by the create_review_task tool. R1: this is a pure SQL rollup;
-- no LLM decides which rows to include - the filter is fixed and versioned
-- in this file.
--
-- A row is on the queue if the encounter has at least one gate that requires
-- coordinator action:
--   fail            - a hard blocker to fix
--   not_evaluated   - missing evidence to obtain (per SPEC §11 - not_evaluated
--                     is a bring-list item, never a fail)
--   conflicting     - two sources disagree; a human must reconcile
--
-- OR there is an open REVIEW_TASK for the patient.
--
-- Advisory-severity gates that fail are surfaced only under a separate
-- "endocrine advisory" bucket to preserve SPEC §5 boundary - HbA1c never
-- blocks surgery.
--
-- Refresh: TARGET_LAG = 5 MINUTE. That matches TASK_REFRESH_READINESS's
-- schedule so the queue view is at most one refresh cycle behind the
-- underlying gate computation. Downstream Streamlit reads this DT directly.

CREATE OR REPLACE DYNAMIC TABLE SAARTHI.OPERATIONAL.DT_REVIEW_QUEUE
  TARGET_LAG = '5 minute'
  REFRESH_MODE = AUTO
  INITIALIZE = ON_CREATE
  WAREHOUSE = SAARTHI_AI_WH
AS
WITH gate_rollup AS (
    SELECT
        rs.patient_id,
        rs.encounter_id,
        SUM(IFF(rs.outcome = 'fail' AND rs.severity = 'blocker', 1, 0))         AS blockers_failed,
        SUM(IFF(rs.outcome = 'not_evaluated' AND rs.severity = 'blocker', 1, 0)) AS blockers_unevaluated,
        SUM(IFF(rs.outcome = 'conflicting', 1, 0))                              AS conflicts,
        SUM(IFF(rs.outcome = 'fail' AND rs.severity = 'advisory', 1, 0))        AS advisory_failed,
        ARRAY_AGG(DISTINCT IFF(rs.outcome IN ('fail','not_evaluated','conflicting'), rs.rule_id, NULL)) AS action_rules,
        MAX(rs.computed_at) AS latest_computed_at
    FROM SAARTHI.OPERATIONAL.READINESS_STATE rs
    GROUP BY rs.patient_id, rs.encounter_id
),
open_tasks AS (
    SELECT
        rt.owner_practitioner_id,
        COUNT(*) AS open_task_count
    FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
    WHERE rt.state = 'open'
    GROUP BY rt.owner_practitioner_id
)
SELECT
    gr.patient_id,
    gr.encounter_id,
    p.name                AS patient_name,
    p.district,
    p.state,
    e.scheduled_time      AS encounter_scheduled,
    gr.blockers_failed,
    gr.blockers_unevaluated,
    gr.conflicts,
    gr.advisory_failed,
    gr.action_rules,
    gr.latest_computed_at,
    CASE
        WHEN gr.blockers_failed > 0            THEN 'blocker_fail'
        WHEN gr.conflicts > 0                  THEN 'conflict'
        WHEN gr.blockers_unevaluated > 0       THEN 'missing_evidence'
        WHEN gr.advisory_failed > 0            THEN 'advisory_only'
        ELSE 'clear'
    END AS queue_status
FROM gate_rollup gr
JOIN SAARTHI.CORE.PATIENT   p ON p.patient_id   = gr.patient_id
LEFT JOIN SAARTHI.CORE.ENCOUNTER e ON e.encounter_id = gr.encounter_id
WHERE gr.blockers_failed > 0
   OR gr.blockers_unevaluated > 0
   OR gr.conflicts > 0
   OR gr.advisory_failed > 0
ORDER BY
    -- Sort by urgency: blocker_fail first, then conflict, then missing, then advisory
    CASE
        WHEN gr.blockers_failed > 0      THEN 1
        WHEN gr.conflicts > 0            THEN 2
        WHEN gr.blockers_unevaluated > 0 THEN 3
        ELSE 4
    END,
    e.scheduled_time ASC NULLS LAST;
