"""Ask + Evidence — the centrepiece screen (SPEC.md 10, WORK-PLAN.md Day 1).

"Build the entire UI against a hard-coded fixture answer. Do not wait for
Stream 2." Day 1's own acceptance test: "Load the app. Click a claim. The
evidence pane opens showing the fixture's page. Switch to a Class A fixture
-> refusal renders with the named practitioner." So this is one screen with
a fixture switcher, not three separate pages — a clinician doesn't know in
advance which class a question turns out to be, and neither does this UI
until it reads `answer["classification"]`.

Swapping the fixture loader for a real tool-procedure call later is meant
to be a one-line change: everything past that point reads `answer` and has
no idea where it came from.
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from frontend.core.contracts import validate_answer
from frontend.core.evidence_packet import generate_packet_id
from frontend.core.evidence_render import describe_evidence

_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"

_FIXTURES = {
    "Supported (CLASS_B) — ANC gate": "answer_supported.json",
    "Partial (CLASS_B) — conflicting and discordant evidence": "answer_conflicting.json",
    "Refused (CLASS_A) — clinical judgment": "answer_class_a.json",
}

st.title("Ask + Evidence")

question = st.text_input(
    "Ask a question about this patient",
    value="Is her ANC recovered enough to resume chemotherapy?",
)

fixture_label = st.selectbox("Fixture (Day-1 demo — stands in for a real answer)", list(_FIXTURES.keys()))
answer = json.loads((_FIXTURES_DIR / _FIXTURES[fixture_label]).read_text())

validation = validate_answer(answer)
if not validation.valid:
    st.error("Fixture answer fails Contract 3 validation:\n" + "\n".join(validation.errors))
    st.stop()

st.caption(f"Known as of {answer['known_as_of']}")

if answer["classification"] == "CLASS_A":
    refusal = answer["refusal"]
    st.warning(refusal["message"])

    practitioner = refusal["practitioner"]
    st.markdown(
        f"**Addressed to:** {practitioner['name']} "
        f"(NMC {practitioner['nmc_registration_no']})"
    )

    for limitation in answer["limitations"]:
        st.caption(limitation)

    if refusal.get("evidence_packet_offered"):
        if st.button("Generate evidence packet"):
            packet_id = generate_packet_id(
                practitioner_id=practitioner["practitioner_id"],
                known_as_of=answer["known_as_of"],
                question=question,
            )
            st.success(
                f"Evidence packet **{packet_id}** generated, addressed to "
                f"{practitioner['name']} (NMC {practitioner['nmc_registration_no']})."
            )

else:
    for limitation in answer["limitations"]:
        st.caption(limitation)

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
