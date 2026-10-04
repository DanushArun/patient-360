-- =============================================================================
-- STEP 15c - DT_SCHEME_ELIGIBILITY (patient x scheme registry)
-- =============================================================================
-- SPEC.md §14 diagram. Cross-joins patients with SCHEME_REGISTRY and applies
-- the scheme's eligibility rules (income ceiling, state domicile). Determines
-- which schemes a patient qualifies for. Deterministic; refreshed on lag.
--
-- Eligibility per SPEC / real Indian scheme rules:
--   PM-JAY: SECC-C families only + income ceiling. We proxy SECC-C
--           membership with a CURRENT (date-valid) COVERAGE.payer_type='scheme' row
--           (present -> eligible; otherwise income_or_seccc_uncertain).
--   State schemes: domicile match is necessary, not sufficient -> 'eligibility_unverified'
--           until income / ration-card evidence exists (never 'eligible' from domicile alone).

CREATE OR REPLACE DYNAMIC TABLE SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY
  TARGET_LAG = '10 minute'
  REFRESH_MODE = FULL
  INITIALIZE = ON_CREATE
  WAREHOUSE = SAARTHI_AI_WH
AS
SELECT
    p.patient_id,
    p.name,
    p.state         AS patient_state,
    sr.scheme_id,
    sr.scheme_name,
    sr.scheme_type,
    sr.annual_limit,
    sr.state_scope,
    CASE
        WHEN sr.scheme_type = 'central' THEN
            CASE WHEN COALESCE(sc.has_current_scheme_coverage, FALSE)
                 THEN 'eligible'
                 ELSE 'income_or_seccc_uncertain'
            END
        -- Domicile alone is not eligibility: income / SECC tests were never evaluated (R1/R3).
        WHEN sr.state_scope = p.state THEN 'eligibility_unverified'
        ELSE 'not_applicable'
    END AS eligibility_status,
    sr.covered_packages
FROM SAARTHI.CORE.PATIENT p
LEFT JOIN (
    -- CURRENT_DATE() is evaluated per refresh, which is why this table is REFRESH_MODE = FULL
    -- (incremental refresh does not support context functions). No correlated subquery.
    SELECT c.patient_id,
           COUNT_IF((c.effective_from IS NULL OR c.effective_from <= CURRENT_DATE())
                AND (c.effective_to   IS NULL OR c.effective_to   >= CURRENT_DATE())) > 0
             AS has_current_scheme_coverage
      FROM SAARTHI.CORE.COVERAGE c
     WHERE c.payer_type = 'scheme'
     GROUP BY c.patient_id
) sc ON sc.patient_id = p.patient_id
CROSS JOIN SAARTHI.OPERATIONAL.SCHEME_REGISTRY sr
WHERE sr.scheme_type = 'central'
   OR sr.state_scope = p.state;
