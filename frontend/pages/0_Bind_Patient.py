"""Bind Patient — COPILOT-SPEC.md 0, step 0: "Coordinator signs in, picks
the patient from a care-team-filtered list. Header shows the binding."

Selection is a human clicking a name in a list filtered by care
relationship and consent — never inferred from question text, never chosen
by the agent. The picker here mirrors that filter client-side
(frontend/core/binding.py); the real authorization boundary is
bind_patient.sql, re-validated server-side on every call, not this page.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import streamlit as st

from frontend.core.binding import bind_patient, care_team_filtered_patients

_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "care_team.json"
_TODAY = date(2026, 9, 18)

st.title("Bind Patient")

care_team = json.loads(_FIXTURE_PATH.read_text())
practitioner_id = care_team["signed_in_practitioner_id"]
practitioner_name = care_team["signed_in_practitioner_name"]

st.caption(f"Signed in as {practitioner_name}")

authorised_patients = care_team_filtered_patients(care_team["patients"], practitioner_id, _TODAY)
options = [p["name"] for p in authorised_patients]

selected_name = st.selectbox("Select a patient", options)

if st.button("Bind"):
    selected_patient = next(p for p in authorised_patients if p["name"] == selected_name)
    binding = bind_patient(
        care_team["patients"], practitioner_id=practitioner_id,
        patient_id=selected_patient["patient_id"], as_of=_TODAY,
    )
    st.session_state["binding"] = binding
    st.session_state["binding_patient_name"] = selected_patient["name"]

binding = st.session_state.get("binding")
if binding is not None:
    st.markdown(
        f"**Bound to:** {st.session_state['binding_patient_name']}  ·  "
        f"**Practitioner:** {practitioner_name}  ·  "
        f"**Consent:** {binding.consent_id}"
    )
