"""Patient 360 — SPEC.md 10: "gate strip, facility timeline, discordance flags — a
2-minute chart review." The oncologist's screen, on rounds.

Design: planning/research/design/DESIGN-SYSTEM.md.

WHAT CHANGED
    The gate strip previously rendered status as an emoji circle: green, red, orange,
    white. Those four differ only in HUE. They are unreadable for the 4-8% of Indian
    males with red-green colour deficiency (clinical-ux-evidence.md 6.2), identical in
    greyscale, and in breach of WCAG 2.2 SC 1.4.1. Status is now a glyph, a word and a
    border style, any one of which is sufficient.

WHY THE STRIP IS NOT A ROW OF TILES
    Five coloured tiles is the dashboard instinct, and the override-rate literature says
    it is how alerts get trained away: ~90% of interruptive CDS alerts are overridden,
    and the failure factor is alerts that are not specific to the patient in front of you
    (clinical-ux-evidence.md 2.1-2.2). So each gate carries its rule id, its version and
    its reason on the same line - the strip is a citation list, not a scoreboard.

STILL TO BUILD
    The spec also calls for a facility timeline and discordance flags on this screen.
    Not built; marked designed-only in IMPLEMENTATION-STATUS.md rather than faked here.
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from frontend.core import answer_render as ar
from frontend.core.design import stylesheet

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "fixtures" / "readiness_four_outcomes.json"
)

st.set_page_config(page_title="Patient 360 — SAARTHI", layout="wide")

with st.sidebar:
    st.markdown("**Demo controls**")
    greyscale = st.toggle(
        "Greyscale audit",
        help="Every gate must stay readable with colour removed.",
        key="p360_greyscale",
    )

st.html(stylesheet(greyscale_audit=greyscale))

readiness = json.loads(_FIXTURE_PATH.read_text())

binding = st.session_state.get("binding")
if binding is None:
    st.html(ar.unbound_masthead())
    st.warning("No patient bound. Go to **Bind Patient** and select one first.")
    st.stop()

patient_name = st.session_state.get("binding_patient_name", binding.patient_id)
st.html(
    ar.masthead(
        patient_name=f"{patient_name} · {binding.patient_id}",
        practitioner_name="Dr. Meera Iyer",
        consent_id=binding.consent_id,
        known_as_of=readiness["known_as_of"],
    )
)

st.html('<div class="sa-field-label" style="margin-bottom:8px">Readiness gates</div>')
for gate_result in readiness["gates"]:
    st.html(ar.gate_row(gate_result))

# R1, restated on every screen that shows an outcome.
st.html(
    '<div class="sa-meta" style="margin-top:24px;max-width:68ch">Gate outcomes are '
    "produced by versioned SQL rules over the record as it stands. Your treating team "
    "decides whether treatment proceeds.</div>"
)
