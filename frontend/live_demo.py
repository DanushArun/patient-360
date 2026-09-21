"""Live demo — calls the REAL deployed Snowflake procedures, not fixtures.

Separate from streamlit_app.py (which is tested against fixtures, 106
AppTest tests) so wiring this up carries zero risk to that test suite.
This is the fastest path to something clickable against real data:
bind_patient -> get_readiness, end to end, against the live account.

Run: streamlit run frontend/live_demo.py
"""

from __future__ import annotations

import json

import snowflake.connector
import streamlit as st

st.set_page_config(page_title="SAARTHI — Live Demo", layout="wide")


@st.cache_resource
def get_connection():
    return snowflake.connector.connect(connection_name="HACKATHON")


def call_procedure(sql: str) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(sql)
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
            result = call_procedure(f"CALL SAARTHI.OPERATIONAL.bind_patient('{patient_id}');")
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
            ref_sql = "NULL" if not encounter_ref else f"'{encounter_ref}'"
            with st.spinner("Calling get_readiness -> evaluate_gates..."):
                result = call_procedure(
                    f"CALL SAARTHI.OPERATIONAL.get_readiness({ref_sql}, NULL);"
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
st.caption("This is a deliberately minimal wiring test, not the final UI. The real 6-screen app (frontend/streamlit_app.py) is built and tested against fixtures — swapping its data source for these same procedures is the remaining integration work.")
