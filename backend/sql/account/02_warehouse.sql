-- =============================================================================
-- STEP 2 - Warehouse
-- =============================================================================
-- SAARTHI_AI_WH backs both Cortex Search services and all AI_* function calls.
-- Search services name a warehouse at creation time (step 17), so it must
-- exist before that. SMALL is sufficient at 100 patients (SCALE-REVIEW.md).
-- AUTO_SUSPEND=60 keeps a $400 trial credit alive across an 18-day judging
-- window with nobody present to suspend it manually.
CREATE WAREHOUSE IF NOT EXISTS SAARTHI_AI_WH
  WAREHOUSE_SIZE = 'SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE
  COMMENT = 'SAARTHI - AI functions and Cortex Search services';
