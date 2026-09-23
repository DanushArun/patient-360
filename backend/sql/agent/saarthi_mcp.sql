-- =============================================================================
-- STEP 19b - SAARTHI_MCP server
-- =============================================================================
-- SPEC.md §14 hackathon "headline bonus" - MCP server exposing the SAARTHI
-- tools via Model Context Protocol. Wraps the same 8 tool procedures that
-- SAARTHI_AGENT uses so a Claude Desktop / Cursor / VS Code MCP client can
-- speak to the same evaluators and search services the agent does.
--
-- Snowflake's MCP server integration exposes stored procedures as MCP tools
-- automatically. Because tools are EXECUTE AS OWNER and the ROW ACCESS POLICY
-- keys on CURRENT_USER(), the same server-side scope enforcement (R5) applies
-- to any MCP client - AGENTS.md §3 rules 1-3 still hold. External MCP clients
-- cannot see any patient the caller's PRACTITIONER row does not have on
-- CARE_TEAM.
--
-- Verification requires an external MCP client and is out of scope for
-- automated tests on this branch; the OBJECT is deployed so a judge with a
-- Claude Desktop can point at the account.

CREATE OR REPLACE MCP SERVER SAARTHI.OPERATIONAL.SAARTHI_MCP
FROM SPECIFICATION
$$
tools:
  - name: "GetPatientFacts"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.get_patient_facts_tool"
    description: "Return typed facts about the currently bound patient. Never asks the LLM to invent values."

  - name: "GetReadiness"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.get_readiness_tool"
    description: "Return current readiness gate outcomes for the bound patient/encounter."

  - name: "SearchPatientDocuments"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.search_patient_documents_tool"
    description: "Search this patient's clinical documents. Corpus is separate from reference (R6)."

  - name: "SearchReferenceDocuments"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.search_reference_documents_tool"
    description: "Search public clinical guidelines / regulatory references."

  - name: "CohortQuery"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.cohort_query_tool"
    description: "Aggregate across the caller-authorised cohort - never returns individual patient rows."

  - name: "GetTimeline"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.get_timeline_tool"
    description: "Return the bound patient's chronology with all three clocks (event, source_recorded, ingested)."

  - name: "GetChanges"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.get_changes_tool"
    description: "Return what changed between two known_as_of cutoffs."

  - name: "CreateReviewTask"
    execute_as: "owner"
    procedure: "SAARTHI.OPERATIONAL.create_review_task_tool"
    description: "The only write path. Emits a REVIEW_TASK with idempotency key."

security:
  omit_patient_id_from_input_schemas: true
  requires_binding: true
$$;
