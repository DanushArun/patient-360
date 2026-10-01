-- =============================================================================
-- STEP 2 - Warehouse
-- =============================================================================
-- SAARTHI_AI_WH backs both Cortex Search services and all AI_* function calls.
-- Search services name a warehouse at creation time (step 17), so it must
-- exist before that. Start at XSMALL for prototype work; increase only after
-- measuring a workload that needs it. IF NOT EXISTS does not resize an existing
-- warehouse. AUTO_SUSPEND limits idle warehouse spend, NOT Cortex Search serving,
-- AI token charges or storage. It cannot guarantee a trial balance lasts.
CREATE WAREHOUSE IF NOT EXISTS SAARTHI_AI_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE
  COMMENT = 'SAARTHI - AI functions and Cortex Search services';
