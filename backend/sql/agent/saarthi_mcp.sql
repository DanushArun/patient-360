-- =============================================================================
-- STEP 19b - SAARTHI_MCP server (Snowflake-managed Model Context Protocol)
-- =============================================================================
-- SPEC.md §14 headline bonus. Exposes SAARTHI to external MCP clients (Claude
-- Desktop, Cursor, VS Code, other Snowflake CoWork agents) as a single
-- governed tool: SAARTHI_AGENT.
--
-- WHY ONLY THE AGENT (not the 8 tool procedures directly):
--   Snowflake's own guidance (docs.snowflake.com/user-guide/snowflake-cortex/
--   cortex-agents-mcp) is explicit:
--     "For business data applications that require governed orchestration,
--      Snowflake recommends exposing a Cortex Agent as the client-facing MCP
--      tool. Exposing SYSTEM_EXECUTE_SQL on the same server allows the MCP
--      client to bypass the agent's semantic views, verified queries, and
--      orchestration; if direct SQL is required, expose it through a separate
--      MCP server with a dedicated least-privileged role."
--   The same reasoning applies to our 8 individual tool procedures: an
--   external client calling get_patient_facts or cohort_query directly would
--   skip the agent's orchestration. R5 Layer 3 would still hold (RAP keys on
--   CURRENT_USER), but nothing else would.
--
--   WHAT THIS PATH DOES NOT GET - stated so no one claims otherwise:
--   CORTEX_AGENT_RUN calls SAARTHI_AGENT directly, NOT ask_saarthi. The
--   keyword-first classify_question and the validate_answer strip that
--   ask_saarthi enforces for the Streamlit and web apps do not run here.
--   Class A refusal on the MCP path rests on the agent's orchestration
--   instruction, and every patient tool refuses with no_patient_bound,
--   because an MCP session carries no PATIENT_BINDING. In practice MCP
--   serves reference-corpus and record-free questions; patient questions
--   go through ask_saarthi.
--
--   One agent-shaped tool. External clients ask questions; SAARTHI_AGENT
--   answers with the same discipline it uses inside Streamlit.
--
-- SECURITY DEFAULTS:
--   - MCP server has NO USAGE by default. Judges/callers must be granted
--     USAGE explicitly (governance/03_grants.sql). Access to the server
--     does not grant access to the tools - Snowflake docs are explicit
--     about this.
--   - The agent still runs as its owner (SAARTHI_APP), so the same
--     patient_scope RAP + USE SECONDARY ROLES NONE session discipline
--     applies to MCP callers.
--   - No SYSTEM_EXECUTE_SQL tool. No GENERIC tools. Single tool = single
--     surface area to review.

CREATE OR REPLACE MCP SERVER SAARTHI.OPERATIONAL.SAARTHI_MCP
FROM SPECIFICATION $$
tools:
  - title: "SAARTHI Care Coordination Agent"
    name: "saarthi_agent"
    type: "CORTEX_AGENT_RUN"
    identifier: "SAARTHI.OPERATIONAL.SAARTHI_AGENT"
    description: "Answer clinician questions about oncology care coordination using SAARTHI's governed evidence pipeline. Handles record-state questions (Class B) with cited answers over the bound patient's clinical events, coverage, documents, and reference guidelines. Refuses clinical-judgment questions (Class A) under NMC TPG 2020 and offers an evidence packet addressed to the treating practitioner. Every answer carries a known_as_of timestamp, evidence ids for each claim, and the rule versions behind every gate outcome."
$$;
