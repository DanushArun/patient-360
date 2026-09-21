-- =============================================================================
-- STEP 4 - Roles
-- =============================================================================
-- 5 roles. Policies (step 7) and grants (step 9) reference them by name, so
-- they come first. SAARTHI_APP is the service role the Streamlit session runs
-- as; the app session must additionally run USE SECONDARY ROLES NONE (F7),
-- or a secondary ACCOUNTADMIN silently satisfies privilege checks that should
-- fail.
CREATE ROLE IF NOT EXISTS SAARTHI_APP
  COMMENT = 'Service role the Streamlit app session runs as. No USAGE on either search service.';
CREATE ROLE IF NOT EXISTS SAARTHI_COORDINATOR
  COMMENT = 'Coordinator - can create/close REVIEW_TASK, sees Review Queue and Review + History';
CREATE ROLE IF NOT EXISTS SAARTHI_ONCOLOGIST
  COMMENT = 'Treating/consulting practitioner - Ask+Evidence, Patient 360';
CREATE ROLE IF NOT EXISTS SAARTHI_NAVIGATOR
  COMMENT = 'Patient navigator - Navigator View bring-list only, cannot create review tasks';
CREATE ROLE IF NOT EXISTS SAARTHI_JUDGE
  COMMENT = 'Read-only role for the Judge Console security probes';

GRANT ROLE SAARTHI_APP TO ROLE ACCOUNTADMIN;
GRANT ROLE SAARTHI_COORDINATOR TO ROLE ACCOUNTADMIN;
GRANT ROLE SAARTHI_ONCOLOGIST TO ROLE ACCOUNTADMIN;
GRANT ROLE SAARTHI_NAVIGATOR TO ROLE ACCOUNTADMIN;
GRANT ROLE SAARTHI_JUDGE TO ROLE ACCOUNTADMIN;

GRANT USAGE ON WAREHOUSE SAARTHI_AI_WH TO ROLE SAARTHI_APP;
