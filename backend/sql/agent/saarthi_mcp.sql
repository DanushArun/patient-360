-- Expose the classified/validated procedure, never the raw orchestration agent.
-- Verified 2026-10-04: GENERIC config.type=procedure is documented at
-- https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp
-- Deployment gate: verify MCP calls preserve the authorized human-selected binding
-- in CURRENT_SESSION(). Without it ASK_SAARTHI returns no_patient_bound.
-- Never add a patient selector to bypass this gate. No privileges are granted here.
CREATE OR REPLACE MCP SERVER SAARTHI.OPERATIONAL.SAARTHI_MCP
FROM SPECIFICATION $$
tools:
  - title: "SAARTHI Guarded Record Answer"
    name: "ask_saarthi"
    type: "GENERIC"
    identifier: "SAARTHI.OPERATIONAL.ASK_SAARTHI"
    description: >
      Answer record questions in the authorized bound session. Classifies before inference
      and validates cited claims. Clinical judgment is refused. Requires a human-selected
      session binding; otherwise fails closed.
    config:
      type: "procedure"
      warehouse: "SAARTHI_AI_WH"
      input_schema:
        type: "object"
        properties:
          QUESTION:
            type: "string"
            description: "A question about the bound record."
        required: ["QUESTION"]
        additionalProperties: false
$$;
