"""Live demo — calls the REAL deployed Snowflake procedures, not fixtures.

Separate from streamlit_app.py (which is tested against fixtures, 106
AppTest tests) so wiring this up carries zero risk to that test suite.

Run: streamlit run scratch_live_demo/live_demo.py
"""

from __future__ import annotations

import json

import snowflake.connector
import streamlit as st

st.set_page_config(page_title="SAARTHI — Live Demo", layout="wide")


@st.cache_resource
def get_connection():
    return snowflake.connector.connect(connection_name="HACKATHON")


def call_procedure(sql: str, params: tuple = ()) -> dict:
    """Parameterized - never interpolates user input directly into SQL text."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(sql, params)
    row = cur.fetchone()
    return json.loads(row[0])


st.title("SAARTHI — Live Demo")
st.caption("Calling the real deployed Snowflake procedures against connection HACKATHON. Nothing here is a fixture.")

col1, col2 = st.columns([1, 2])

with col1:
    st.subheader("1. Bind a patient")
    patient_id = st.text_input("Patient ID", value="PAT-DEEP-0001")
    if st.button("Bind"):
        with st.spinner("Calling bind_patient..."):
            result = call_procedure(
                "CALL SAARTHI.OPERATIONAL.bind_patient(%s);", (patient_id,)
            )
        st.session_state["bind_result"] = result

    if "bind_result" in st.session_state:
        result = st.session_state["bind_result"]
        if "error" in result:
            st.error(f"{result['error']}")
        else:
            st.success(f"Bound. binding_id: {result['binding_id']}")

with col2:
    st.subheader("2. Get readiness (evaluate_gates via the real rule engine)")
    encounter_ref = st.text_input("Encounter ref (blank = most recent)", value="")
    if st.button("Get Readiness"):
        if "bind_result" not in st.session_state or "error" in st.session_state["bind_result"]:
            st.warning("Bind a patient first.")
        else:
            with st.spinner("Calling get_readiness -> evaluate_gates..."):
                result = call_procedure(
                    "CALL SAARTHI.OPERATIONAL.get_readiness(%s, NULL);",
                    (encounter_ref or None,),
                )
            st.session_state["readiness_result"] = result

    if "readiness_result" in st.session_state:
        result = st.session_state["readiness_result"]
        if "error" in result:
            st.error(f"{result['error']}")
        else:
            st.caption(f"known_as_of: {result['known_as_of']}")
            for gate in result.get("gates", []):
                outcome = gate["outcome"]
                icon = {"pass": "✅", "fail": "🛑", "not_evaluated": "❔", "conflicting": "⚠️"}.get(outcome, "•")
                with st.container(border=True):
                    st.markdown(f"{icon} **{gate['rule_id']}** ({gate['gate']}) — `{outcome}`")
                    st.write(gate.get("reason", ""))
                    if gate.get("derived"):
                        st.caption(f"Derived: {gate['derived']}")
                    if gate.get("evidence_ids"):
                        st.caption(f"Evidence: {', '.join(gate['evidence_ids'])}")

st.divider()
st.subheader("3. Ask SAARTHI (the real agent — claude-opus-5 orchestrating 8 tools)")
question = st.text_input(
    "Ask a question about the bound patient",
    value="What is missing before the next visit?",
    key="question",
)
sample_qs = [
    "What is missing before the next visit?",
    "Should she proceed with chemotherapy on Thursday?",
    "Is the pathology report final?",
]
st.caption("Try: " + "  ·  ".join(f"*{q}*" for q in sample_qs))

if st.button("Ask", type="primary"):
    if "bind_result" not in st.session_state or "error" in st.session_state["bind_result"]:
        st.warning("Bind a patient first.")
    else:
        with st.spinner("Agent is reasoning and calling tools..."):
            result = call_procedure(
                "CALL SAARTHI.OPERATIONAL.ask_saarthi(%s);", (question,)
            )
        st.session_state["agent_result"] = result

if "agent_result" in st.session_state:
    result = st.session_state["agent_result"]
    if "error" in result:
        st.error(f"{result['error']}")
    else:
        # The agent's response content is a list of blocks; render text blocks
        # and show which tools it called (or didn't - Class A refusals should
        # show zero tool calls).
        content = result.get("content", [])
        for block in content:
            if block.get("type") == "text":
                st.markdown(block["text"])
        with st.expander("Show raw agent response (tool calls, model, tokens)"):
            st.json(result)

st.divider()
st.caption(
    "This is a deliberately minimal wiring test, not the final UI. The real 6-screen app "
    "(frontend/streamlit_app.py) is built and tested against fixtures — swapping its data "
    "source for these same procedures is the remaining integration work."
)
