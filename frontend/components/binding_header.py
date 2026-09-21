"""Persistent binding header — REPO-STRUCTURE.md: "Shows who the answer is
about." COPILOT-SPEC.md 0: every claim on every screen has to be traceable
to a human's click, so the header that names that click has to be visible
everywhere a claim can appear, not just on the page where the click
happened.

Reads `st.session_state["binding"]`, set by frontend/pages/0_Bind_Patient.py.
Session state is how Streamlit shares this across pages within one running
session — there is no server round-trip standing in for it here, and none
is needed until a page actually calls a bound-patient tool procedure.
"""

from __future__ import annotations

import streamlit as st


def render_binding_header(practitioner_name: str) -> None:
    binding = st.session_state.get("binding")
    if binding is None:
        st.warning("No patient bound. Go to **Bind Patient** and select one first.")
        return

    patient_name = st.session_state.get("binding_patient_name", binding.patient_id)
    st.markdown(
        f"**Bound to:** {patient_name}  ·  **Practitioner:** {practitioner_name}  ·  "
        f"**Consent:** {binding.consent_id}"
    )
