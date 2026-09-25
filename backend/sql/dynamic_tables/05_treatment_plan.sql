-- =============================================================================
-- STEP 15d - DT_TREATMENT_PLAN (current active plan per patient)
-- =============================================================================
-- SPEC.md §14 diagram. Latest treatment plan per patient. A plan is 'current'
-- if it has the highest version number AND has not been superseded by another
-- plan (SUPERSEDES_PLAN_ID chain). Deterministic; refreshed on lag.
--
-- Downstream reads: Patient 360 screen (regimen + intent + cycle count),
-- readiness explainers (rule provenance often cites the active regimen).

CREATE OR REPLACE DYNAMIC TABLE SAARTHI.OPERATIONAL.DT_TREATMENT_PLAN
  TARGET_LAG = '10 minute'
  REFRESH_MODE = AUTO
  INITIALIZE = ON_CREATE
  WAREHOUSE = SAARTHI_AI_WH
AS
WITH ranked_plans AS (
    SELECT
        tp.*,
        ROW_NUMBER() OVER (
            PARTITION BY tp.patient_id
            ORDER BY tp.version DESC, tp.decided_at DESC
        ) AS plan_rank
    FROM SAARTHI.CORE.TREATMENT_PLAN tp
    WHERE NOT EXISTS (
        SELECT 1 FROM SAARTHI.CORE.TREATMENT_PLAN tp2
         WHERE tp2.supersedes_plan_id = tp.plan_id
    )
)
SELECT
    plan_id,
    patient_id,
    version,
    regimen_code,
    regimen_display,
    intent,
    planned_cycles,
    decided_at,
    decided_by_practitioner_id,
    decision_forum,
    supersedes_plan_id,
    reason_for_change
FROM ranked_plans
WHERE plan_rank = 1;
