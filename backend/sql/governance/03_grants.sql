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

-- Procedure grants are NOT made here. The app role gets USAGE on its named
-- entry points only, in governance/05_procedure_grants.sql (step 19c), after
-- every procedure, the agent and the MCP server exist. The blanket
-- ALL/FUTURE PROCEDURES grant that used to sit here exposed internal
-- owner's-rights procedures such as EVALUATE_GATES(patient_id, ...), which
-- takes a caller-supplied patient id and checks no binding - a direct path
-- around R5 for anyone holding the app role.

-- The role each Snowflake user session runs as also needs role membership -
-- USE SECONDARY ROLES NONE is set in the application session (Streamlit
-- connection config), not here; this only wires the ownership chain.
GRANT ROLE SAARTHI_APP TO ROLE SAARTHI_COORDINATOR;
GRANT ROLE SAARTHI_APP TO ROLE SAARTHI_ONCOLOGIST;
GRANT ROLE SAARTHI_APP TO ROLE SAARTHI_NAVIGATOR;

