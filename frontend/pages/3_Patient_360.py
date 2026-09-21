"""Patient 360 — SPEC.md 10: "gate strip, facility timeline, discordance
flags — a 2-minute chart review." This slice is the gate strip: 5 gates,
each a 4-valued outcome, never a boolean (SPEC.md 356/487).

Built against frontend/fixtures/readiness_four_outcomes.json, the same
fixture-first approach as the Ask + Evidence page — swapping the loader for
a real get_readiness() call is meant to be a one-line change.
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from frontend.components.binding_header import render_binding_header
from frontend.core.gate_render import describe_gate

_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "readiness_four_outcomes.json"

_SEVERITY_ICON = {"good": "🟢", "bad": "🔴", "warn": "🟠", "neutral": "⚪"}

st.title("Patient 360")
render_binding_header(practitioner_name="Dr. Meera Iyer")

readiness = json.loads(_FIXTURE_PATH.read_text())
st.caption(f"Known as of {readiness['known_as_of']}")

for gate_result in readiness["gates"]:
    description = describe_gate(gate_result)
    icon = _SEVERITY_ICON[description.severity]
    st.markdown(f"{icon}  **{description.gate.capitalize()}** — {description.label}  ·  {description.detail}")
