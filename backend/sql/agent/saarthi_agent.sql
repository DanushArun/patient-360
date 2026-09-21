-- =============================================================================
-- STEP 19 - SAARTHI_AGENT
-- =============================================================================
-- SPEC.md §6, ADR-004. Only `generic` tools over procedures - never a raw
-- cortex_search or cortex_analyst_text_to_sql tool over patient data (A1:
-- given a reachable parameter, the agent derives patient_id from the
-- question text and injects the filter itself). patient_id is OMITTED from
-- every tool input schema below - unreachable by construction, not by
-- instruction. orchestration is pinned to claude-opus-4-8, never 'auto'
-- (AGENTS.md: auto re-selects upward silently, invalidating measured
-- accuracy and cost).
CREATE OR REPLACE AGENT SAARTHI.OPERATIONAL.SAARTHI_AGENT
  COMMENT = 'SAARTHI care-readiness copilot. 8 generic tools, patient_id unreachable by construction.'
  FROM SPECIFICATION
  $$
  models:
    orchestration: "claude-opus-4-8"

  instructions:
    response: >
      Answer only from tool results. Never state a status, number, date, or
      threshold comparison that did not come from a tool's returned facts.
      Every claim must cite the evidence_ids or event_id the tool returned.
      If a tool returns an error (no_patient_bound, no_patient_access,
      access_withdrawn, binding_mismatch, consent_not_valid), report exactly
      that outcome and nothing about why - never guess or soften it.
    orchestration: >
      Never ask a tool for a patient identifier - no tool accepts one. The
      subject is always whichever patient is already bound in this session.
      For a question requiring clinical judgment, prognosis, dosing, or a
      recommendation, do not call any tool - state that this requires the
      treating practitioner's judgment.
    sample_questions:
      - question: "What is missing before Thursday?"
      - question: "Is the pathology report final?"
      - question: "What changed since 09:00?"

  tools:
    - tool_spec:
        type: "generic"
        name: "GetPatientFacts"
        description: "Structured facts for the bound patient by domain (demographics, labs, coverage, treatment_plan, encounters, identity). Takes no patient selector."
        input_schema:
          type: "object"
          properties:
            domain: {type: "string", description: "One of demographics, labs, coverage, treatment_plan, encounters, identity"}
            known_as_of: {type: "string", description: "Optional ISO timestamp cutoff"}
          required: ["domain"]
    - tool_spec:
        type: "generic"
        name: "GetReadiness"
        description: "Returns the 5 care-readiness gates for the bound patient. Takes no patient selector."
        input_schema:
          type: "object"
          properties:
            encounter_ref: {type: "string", description: "Optional; must belong to the bound patient. Omit for the next/most recent encounter."}
            known_as_of: {type: "string", description: "Optional ISO timestamp cutoff"}
          required: []
    - tool_spec:
        type: "generic"
        name: "SearchPatientDocuments"
        description: "Searches the bound patient's documents only. Server-injects the scope filter. Takes no patient selector."
        input_schema:
          type: "object"
          properties:
            query: {type: "string", description: "Natural language search query"}
            known_as_of: {type: "string", description: "Optional ISO timestamp cutoff"}
          required: ["query"]
    - tool_spec:
        type: "generic"
        name: "SearchReferenceDocuments"
        description: "Searches real regulatory/clinical reference text only. Never contains patient data."
        input_schema:
          type: "object"
          properties:
            query: {type: "string"}
            jurisdiction: {type: "string"}
            effective_date: {type: "string"}
          required: ["query"]
    - tool_spec:
        type: "generic"
        name: "CohortQuery"
        description: "Aggregate questions across the permitted patient set. Unavailable while a patient is bound - release the binding first."
        input_schema:
          type: "object"
          properties:
            question: {type: "string"}
          required: ["question"]
    - tool_spec:
        type: "generic"
        name: "GetTimeline"
        description: "Full chronology for the bound patient with all three time clocks. Takes no patient selector."
        input_schema:
          type: "object"
          properties:
            known_as_of: {type: "string"}
          required: []
    - tool_spec:
        type: "generic"
        name: "GetChanges"
        description: "Diffs two known_as_of states for the bound patient - answers 'what changed since X?'"
        input_schema:
          type: "object"
          properties:
            from_ts: {type: "string", description: "Required ISO timestamp"}
            to_ts: {type: "string", description: "Optional ISO timestamp, defaults to now"}
          required: ["from_ts"]
    - tool_spec:
        type: "generic"
        name: "CreateReviewTask"
        description: "The only write tool. Restricted to treating/coordinator roles. action must be one of escalate, close, reassign, request_document."
        input_schema:
          type: "object"
          properties:
            issue_id: {type: "string"}
            action: {type: "string"}
            reason: {type: "string"}
            idempotency_key: {type: "string", description: "Required - a retry with the same key never double-fires"}
          required: ["issue_id", "action", "reason", "idempotency_key"]

  tool_resources:
    GetPatientFacts:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.GET_PATIENT_FACTS"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
    GetReadiness:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.GET_READINESS"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
    SearchPatientDocuments:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.SEARCH_PATIENT_DOCUMENTS"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
    SearchReferenceDocuments:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.SEARCH_REFERENCE_DOCUMENTS"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
    CohortQuery:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.COHORT_QUERY"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
    GetTimeline:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.GET_TIMELINE"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
    GetChanges:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.GET_CHANGES"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
    CreateReviewTask:
      type: "procedure"
      identifier: "SAARTHI.OPERATIONAL.CREATE_REVIEW_TASK"
      execution_environment: {type: "warehouse", warehouse: "SAARTHI_AI_WH"}
  $$;
