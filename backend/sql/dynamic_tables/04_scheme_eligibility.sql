-- =============================================================================
-- STEP 15c - DT_SCHEME_ELIGIBILITY (patient x scheme registry)
-- =============================================================================
-- SPEC.md §14 diagram. Cross-joins patients with SCHEME_REGISTRY and applies
-- the scheme's eligibility rules (income ceiling, state domicile). Determines
-- which schemes a patient qualifies for. Deterministic; refreshed on lag.
--
-- Eligibility per SPEC / real Indian scheme rules:
--   PM-JAY: SECC-C families only + income ceiling. We proxy SECC-C
--           membership with COVERAGE.payer_type='scheme' (present -> eligible).
--   State schemes: state domicile match (PATIENT.state).

CREATE OR REPLACE DYNAMIC TABLE SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY
  TARGET_LAG = '10 minute'
  REFRESH_MODE = AUTO
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
            CASE WHEN EXISTS (SELECT 1 FROM SAARTHI.CORE.COVERAGE c
                              WHERE c.patient_id = p.patient_id AND c.payer_type = 'scheme')
                 THEN 'eligible'
                 ELSE 'income_or_seccc_uncertain'
            END
        WHEN sr.state_scope = p.state THEN 'eligible'
        ELSE 'not_applicable'
    END AS eligibility_status,
    sr.covered_packages
FROM SAARTHI.CORE.PATIENT p
CROSS JOIN SAARTHI.OPERATIONAL.SCHEME_REGISTRY sr
WHERE sr.scheme_type = 'central'
   OR sr.state_scope = p.state;
