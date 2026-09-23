-- =============================================================================
-- STEP 9 - Grants   *** RED STEP ***
-- =============================================================================
-- The app role gets NO USAGE on either search service (created in step 17).
-- Retrieval happens only through owner's-rights procedures (step 14).
-- F7: "the app role has no USAGE" is FALSE while secondary roles are active -
-- a secondary ACCOUNTADMIN satisfies the privilege check through the back
-- door and the GRANT audit still looks correct. Every app session MUST run
-- USE SECONDARY ROLES NONE, or authenticate as a dedicated service user.
-- This file only ever grants what SAARTHI_APP needs to run the Streamlit UI
-- and call procedures - it never grants USAGE on PATIENT_DOC_SEARCH or
-- REFERENCE_DOC_SEARCH, and no later step may add that grant.

GRANT USAGE ON DATABASE SAARTHI TO ROLE SAARTHI_APP;
GRANT USAGE ON DATABASE SAARTHI TO ROLE SAARTHI_COORDINATOR;
GRANT USAGE ON DATABASE SAARTHI TO ROLE SAARTHI_ONCOLOGIST;
GRANT USAGE ON DATABASE SAARTHI TO ROLE SAARTHI_NAVIGATOR;
GRANT USAGE ON DATABASE SAARTHI TO ROLE SAARTHI_JUDGE;

GRANT USAGE ON ALL SCHEMAS IN DATABASE SAARTHI TO ROLE SAARTHI_APP;
GRANT USAGE ON FUTURE SCHEMAS IN DATABASE SAARTHI TO ROLE SAARTHI_APP;

-- The app calls owner's-rights procedures (EXECUTE AS OWNER) - it needs
-- EXECUTE, never direct SELECT on the governed tables. Future-proofed so
-- procedures created in step 14 do not need a second grants pass.
GRANT USAGE ON ALL PROCEDURES IN SCHEMA SAARTHI.OPERATIONAL TO ROLE SAARTHI_APP;
GRANT USAGE ON FUTURE PROCEDURES IN SCHEMA SAARTHI.OPERATIONAL TO ROLE SAARTHI_APP;

-- The role each Snowflake user session runs as also needs role membership -
-- USE SECONDARY ROLES NONE is set in the application session (Streamlit
-- connection config), not here; this only wires the ownership chain.
GRANT ROLE SAARTHI_APP TO ROLE SAARTHI_COORDINATOR;
GRANT ROLE SAARTHI_APP TO ROLE SAARTHI_ONCOLOGIST;
GRANT ROLE SAARTHI_APP TO ROLE SAARTHI_NAVIGATOR;

-- Agent + MCP server access. Snowflake docs are explicit that USAGE on an
-- MCP SERVER does NOT confer USAGE on the underlying tools; both grants are
-- required for a caller to invoke the agent via MCP. SAARTHI_APP is the
-- effective role for every Streamlit / Cortex Agent REST call and for
-- external MCP clients that authenticate as a role linked to SAARTHI_APP.
--
-- No secondary-role trap here either: the agent's RAP (patient_scope on
-- CURRENT_USER) still fires regardless of which role wraps the session,
-- and USE SECONDARY ROLES NONE remains mandatory app-side.
GRANT USAGE ON AGENT SAARTHI.OPERATIONAL.SAARTHI_AGENT TO ROLE SAARTHI_APP;
GRANT USAGE ON MCP SERVER SAARTHI.OPERATIONAL.SAARTHI_MCP TO ROLE SAARTHI_APP;
