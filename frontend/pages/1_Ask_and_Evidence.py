"""Ask + Evidence — the centrepiece screen (SPEC.md 10, WORK-PLAN.md Day 1).

"Build the entire UI against a hard-coded fixture answer. Do not wait for
Stream 2." This page renders `frontend/fixtures/answer_supported.json`
end to end: question input, known_as_of, per-claim text, and an evidence
pane that opens on click, dispatching on evidence kind via
`frontend/core/evidence_render.py` so a reference clause can never
accidentally render in the same panel style as patient evidence (R6).

Swapping the fixture for a real tool-procedure call later is meant to be a
one-line change: everything below reads `answer`, nothing here knows it
came from a JSON file.
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from frontend.core.contracts import validate_answer
from frontend.core.evidence_render import describe_evidence

_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "answer_supported.json"

st.title("Ask + Evidence")

st.text_input(
    "Ask a question about this patient",
    value="Is her ANC recovered enough to resume chemotherapy?",
)

answer = json.loads(_FIXTURE_PATH.read_text())
validation = validate_answer(answer)
if not validation.valid:
    st.error("Fixture answer fails Contract 3 validation:\n" + "\n".join(validation.errors))
    st.stop()

st.caption(f"Known as of {answer['known_as_of']}")

for i, claim in enumerate(answer["claims"]):
    st.markdown(claim["text"])

    toggle_key = f"show_evidence_{i}"
    if st.button("Show evidence", key=f"evidence_button_{i}"):
        st.session_state[toggle_key] = not st.session_state.get(toggle_key, False)

    if st.session_state.get(toggle_key):
        for ev in claim["evidence"]:
            description = describe_evidence(ev)
            panel = st.info if description.is_patient_evidence else st.success
            if description.kind == "document_span":
                panel = st.warning
            panel(f"**{description.headline}**\n\n{description.detail}")
