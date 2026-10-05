-- Manual role provisioning after setup.sql. No token, user or network policy is created.
-- Authenticate as the approved account administrator. Never run this against another
-- account without checking its identity. Existing broad procedure/agent grants are removed.
-- MCP transport sessions do not prove CURRENT_SESSION() patient-binding continuity.
-- The gateway must deny an unbound invocation; never add a patient selector to the tool.
USE ROLE ACCOUNTADMIN;
USE SECONDARY ROLES NONE;

CREATE ROLE IF NOT EXISTS SAARTHI_MCP_CLIENT
    COMMENT = 'MCP server and guarded ASK procedure only; no raw agent, tables or search access';
GRANT USAGE ON DATABASE SAARTHI TO ROLE SAARTHI_MCP_CLIENT;
GRANT USAGE ON SCHEMA SAARTHI.OPERATIONAL TO ROLE SAARTHI_MCP_CLIENT;
GRANT USAGE ON WAREHOUSE SAARTHI_AI_WH TO ROLE SAARTHI_MCP_CLIENT;
GRANT USAGE ON MCP SERVER SAARTHI.OPERATIONAL.SAARTHI_MCP TO ROLE SAARTHI_MCP_CLIENT;
REVOKE USAGE ON AGENT SAARTHI.OPERATIONAL.SAARTHI_AGENT FROM ROLE SAARTHI_MCP_CLIENT;
REVOKE USAGE ON ALL PROCEDURES IN SCHEMA SAARTHI.OPERATIONAL FROM ROLE SAARTHI_MCP_CLIENT;
REVOKE USAGE ON FUTURE PROCEDURES IN SCHEMA SAARTHI.OPERATIONAL FROM ROLE SAARTHI_MCP_CLIENT;
GRANT USAGE ON PROCEDURE SAARTHI.OPERATIONAL.ASK_SAARTHI(VARCHAR) TO ROLE SAARTHI_MCP_CLIENT;

SHOW GRANTS TO ROLE SAARTHI_MCP_CLIENT;
-- Assign the role only to the explicitly selected operator with a matching practitioner
-- and care-team record. Configure that user's approved network CIDRs before PAT creation.
-- Generate a role-restricted, short-lived PAT interactively; retain it in a secret store.
-- See docs/submission/TEAMMATE-ACCOUNT-RUNBOOK.md for runtime and boundary acceptance.
