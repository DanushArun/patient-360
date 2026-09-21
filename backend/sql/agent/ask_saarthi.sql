-- =============================================================================
-- STEP 19b - ask_saarthi (calls SAARTHI_AGENT)
-- =============================================================================
-- Thin wrapper the Streamlit app calls to run a question through the agent.
-- Not a Contract 2 tool - this is the entry point INTO the agent, not one of
-- its tools. DATA_AGENT_RUN's JSON payload must be materialised into a
-- variable first - passing an inline OBJECT_CONSTRUCT/TO_JSON expression is
-- rejected ("argument needs to be constant"), verified live.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ask_saarthi(QUESTION VARCHAR)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Runs a question through SAARTHI_AGENT for the current session binding.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_payload VARCHAR;
    v_result  VARCHAR;
BEGIN
    v_payload := (SELECT TO_JSON(OBJECT_CONSTRUCT(
        'messages', ARRAY_CONSTRUCT(
            OBJECT_CONSTRUCT('role', 'user', 'content',
                ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('type', 'text', 'text', :QUESTION)))
        )
    )));
    v_result := (SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN('SAARTHI.OPERATIONAL.SAARTHI_AGENT', :v_payload));
    RETURN PARSE_JSON(:v_result);
END;
$$;
