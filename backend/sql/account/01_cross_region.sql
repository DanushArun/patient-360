-- =============================================================================
-- STEP 1 - Account parameter
-- =============================================================================
-- GCP_ME_CENTRAL2 has NO local AI_COMPLETE endpoint. Without this, every AI
-- function in the pipeline (AI_PARSE_DOCUMENT, AI_COMPLETE, AI_FILTER,
-- AI_CLASSIFY, AI_TRANSLATE, Cortex Search, Cortex Analyst, Cortex Agent)
-- fails, and the failure surfaces somewhere unrelated - not here. Line one.
-- Idempotent: ALTER ACCOUNT SET is not additive, safe to re-run.
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';
