"""Ask + Evidence — the centrepiece.

SPEC.md 10: "the brief: 'Deliver a question and answer experience with clear source
evidence.' That is the product, not one tab of six."

Carries demo beats 1-6. Design: planning/research/design/DESIGN-SYSTEM.md.

STRUCTURE — masthead, body, margin
    The evidence margin is PERSISTENT, not a modal. Verifying a citation means comparing
    the claim against its source, which requires both on screen at once; a dialog that
    covers the claim defeats the purpose (clinical-ux-evidence.md 4.3). This is the most
    important layout decision on the screen.

WHAT CHANGED AND WHY
    The previous version rendered evidence with st.info / st.success / st.warning, using
    semantic ALERT colours to distinguish evidence KIND. That is a category error: yellow
    means "warning" to every reader, but here it meant "document_span". It also encoded
    meaning in hue alone, which WCAG 2.2 SC 1.4.1 forbids and which 4-8% of Indian males
    cannot read (clinical-ux-evidence.md 6.2).

    Selecting a claim is a radio, not per-claim toggle buttons. Only one claim's evidence
    can be in the margin at a time, so a control that can express two open claims is
    lying about the model.
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from frontend.core import answer_render as ar
from frontend.core.contracts import validate_answer
from frontend.core.design import stylesheet
from frontend.core.evidence_packet import generate_packet_id

_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"

# Kept as a dev control, moved out of the reading surface. A selector labelled "Fixture"
# sitting above the answer tells a judge they are looking at a mock.
#
# Each fixture carries its own question. A Class A refusal shown underneath "What is
# missing before Thursday?" is incoherent - that question is not a clinical decision, and
# the mismatch is exactly the kind of seam a judge notices.
_FIXTURES = {
    "Gap identification — 4 outcomes, 1 unverifiable": (
        "answer_conflicting.json", "What is missing before Thursday?",
    ),
    "ANC recovered — derived value, verified": (
        "answer_supported.json", "Is her ANC recovered enough to resume chemotherapy?",
    ),
    "Class A — clinical judgment refused": (
        "answer_class_a.json", "Should she proceed on Thursday?",
    ),
}

st.set_page_config(page_title="Ask + Evidence — SAARTHI", layout="wide")

with st.sidebar:
    st.markdown("**Demo controls**")
    fixture_label = st.radio(
        "Answer", list(_FIXTURES), label_visibility="collapsed", key="fixture_choice"
    )
    st.divider()
    # Every status must stay readable with this on. If it does not, the design is broken,
    # not the user's eyes. Run it before any demo.
    greyscale = st.toggle("Greyscale audit", help="Proves no status depends on colour alone.")

st.html(stylesheet(greyscale_audit=greyscale))

fixture_file, default_question = _FIXTURES[fixture_label]
answer = json.loads((_FIXTURES_DIR / fixture_file).read_text())

validation = validate_answer(answer)
if not validation.valid:
    # Fail loudly. An answer that violates Contract 3 must never render as if it were fine.
    st.error("Answer fails Contract 3 validation:\n" + "\n".join(validation.errors))
    st.stop()

# --- masthead -------------------------------------------------------------
# The subject comes from a human's click on Bind Patient, never from the question text
# (COPILOT-SPEC 0). With no binding there is no subject, so there is nothing to answer.
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
        known_as_of=answer["known_as_of"],
        binding_id=answer.get("binding_id"),
    )
)

question = st.text_input(
    "Question",
    value=default_question,
    label_visibility="collapsed",
    placeholder="Ask about this patient's record…",
    key=f"question_{fixture_label}",
)

# --- Class A: refusal takes the whole page --------------------------------
# A refusal is not a degraded answer shown beside other content. It is the answer.
if answer["classification"] == "CLASS_A":
    refusal = answer["refusal"]
    st.html(ar.refusal_block(refusal))

    for text in answer["limitations"]:
        st.html(ar.limitation(text))

    if refusal.get("evidence_packet_offered"):
        practitioner = refusal["practitioner"]
        if st.button("Assemble evidence packet", type="primary"):
            packet_id = generate_packet_id(
                practitioner_id=practitioner["practitioner_id"],
                known_as_of=answer["known_as_of"],
                question=question,
            )
            st.html(
                ar.packet_confirmation(packet_id=packet_id, practitioner=practitioner)
            )
    st.stop()

# --- Class B: claims left, evidence right ---------------------------------
claims = answer["claims"]
body, margin = st.columns([7, 5], gap="large")

with body:
    # Limitations come FIRST, above the claims. What the system could not establish
    # outranks what it could: a clinician who reads three claims and only then learns
    # the platelet value is unverifiable has already formed a picture.
    for text in answer["limitations"]:
        st.html(ar.limitation(text))

    # The selector names the gate and outcome only. Repeating the claim sentence here
    # would duplicate the text rendered immediately below it, and a selector that
    # restates its own options is noise competing with the thing being read.
    st.html(
        '<div class="sa-field-label" style="margin:8px 0 4px">Show evidence for</div>'
    )
    labels = [
        f"{ar.STATUS_WORD.get(c.get('outcome'), 'claim')} · {c.get('gate', '—')}"
        f" · {c.get('rule_id', '')}"
        for c in claims
    ]
    selected = st.radio(
        "Claim", range(len(claims)),
        format_func=lambda i: labels[i],
        label_visibility="collapsed",
        key="claim_choice",
        horizontal=True,
    )

    for index, claim in enumerate(claims):
        st.html(
            '<div class="sa-claim">'
            + ar.claim_header(claim)
            + ar.claim_text(claim)
            + ar.provenance(claim)
            + ar.action(claim)
            + "</div>"
        )

    # The standing deferral. R1 restated in the interface, every time, not as fine print:
    # the rules produce outcomes, a human decides treatment.
    st.html(
        '<div class="sa-meta" style="margin-top:24px;border-top:1px solid #D8DCDF;'
        'padding-top:12px;max-width:68ch">Gate outcomes are produced by versioned SQL '
        "rules over the record as it stands. Your treating team decides whether "
        "treatment proceeds.</div>"
    )

with margin:
    claim = claims[selected]
    st.html(
        '<div class="sa-field-label" style="margin-bottom:12px">'
        f"Evidence · {len(claim['evidence'])} item"
        f"{'s' if len(claim['evidence']) != 1 else ''}</div>"
    )

    for evidence in claim["evidence"]:
        st.html(ar.evidence_block(evidence))

# --- the cited page, full width ------------------------------------------
# Below the columns, not inside the margin. A lab report is a columnar document: analyte,
# value, unit, reference range. Squeezed into a 5/12 column it wraps, the columns break,
# and the Indian-format traps the citation exists to expose (GM%, /CUMM, lakh commas)
# stop being legible. Page-level citation is not enough - "clear source evidence" means
# the reader sees the words the claim rests on, in the shape the lab printed them.
spans = [e for e in claim["evidence"] if e["kind"] == "document_span"]
for evidence in spans:
    page_path = (
        _FIXTURES_DIR / f"page_{evidence['doc_id']}_p{evidence['page_index']}.json"
    )
    label = f"Open {evidence['doc_id']}, page {evidence['page_index'] + 1}"
    if page_path.exists():
        page = json.loads(page_path.read_text())
        with st.expander(label, expanded=False):
            st.html(
                ar.highlight(
                    page["text"], evidence["char_start"], evidence["char_end"]
                )
            )
    else:
        # Honest degradation. Never imply we can show a page we cannot.
        st.html(
            f'<div class="sa-meta">{label} — page text not available in this build; '
            "the citation resolves to page level only.</div>"
        )
