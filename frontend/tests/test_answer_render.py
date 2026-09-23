"""Tests for frontend/core/answer_render.py.

These carry most of the weight for the Ask + Evidence screen. `st.html` output is not
visible to Streamlit's AppTest, so the page test can only assert wiring; the rendering
contract is asserted here instead, against pure functions.

That split is deliberate and better than what it replaces. The previous page tests
asserted on `st.info` / `st.warning` panel text, which coupled them to a styling choice -
they would pass with the evidence pane rendered in the wrong colour, and fail on a purely
visual change that broke nothing.

Fixtures are the real ones in frontend/fixtures/, not inline dicts, so a fixture that
drifts from the schema breaks a test rather than silently diverging from the demo.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from frontend.core import answer_render as ar

_FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def _answer(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text())


@pytest.fixture
def supported() -> dict:
    return _answer("answer_supported.json")


@pytest.fixture
def conflicting() -> dict:
    return _answer("answer_conflicting.json")


@pytest.fixture
def class_a() -> dict:
    return _answer("answer_class_a.json")


# --- escaping: the security boundary --------------------------------------
# Every builder renders through unsafe_allow_html, and some of it is patient document
# text. SPEC.md ships a probe for an instruction injected into a document; a document can
# carry markup just as easily. An unescaped interpolation here is an XSS hole.

def test_claim_text_escapes_markup():
    html = ar.claim_text({"text": "<script>alert(1)</script> ANC low"})
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_limitation_escapes_markup():
    assert "<img" not in ar.limitation('<img src=x onerror="alert(1)">')


def test_refusal_escapes_the_practitioner_name():
    html = ar.refusal_block({
        "message": "ok",
        "practitioner": {
            "practitioner_id": "P1",
            "name": "<b>Dr Evil</b>",
            "nmc_registration_no": "X",
        },
    })
    assert "<b>Dr Evil</b>" not in html
    assert "&lt;b&gt;" in html


def test_highlight_escapes_page_text_around_the_mark():
    text = "before <script>bad</script> CITED after"
    start = text.index("CITED")
    html = ar.highlight(text, start, start + 5)
    assert "<script>" not in html
    assert "<mark>CITED</mark>" in html   # the mark itself survives


# --- highlight offsets ----------------------------------------------------

def test_highlight_marks_exactly_the_cited_range():
    # The real span from page_DOC-0052_p1.json: AS-7741 -> "Neutrophils            35"
    page = json.loads((_FIXTURES / "page_DOC-0052_p1.json").read_text())
    span = page["spans"]["AS-7741"]
    html = ar.highlight(page["text"], span["char_start"], span["char_end"])
    assert f'<mark>{span["text"]}</mark>' in html


def test_highlight_offsets_are_computed_before_escaping():
    """Escaping first would shift every offset - one "&" becomes five characters.

    This is the bug the per-segment escape exists to prevent, so it gets a test.
    """
    text = "a & b CITED"
    start = text.index("CITED")
    html = ar.highlight(text, start, start + 5)
    assert "<mark>CITED</mark>" in html
    assert "a &amp; b" in html


@pytest.mark.parametrize(
    "start,end",
    [(-1, 5), (0, 0), (5, 3), (0, 9999), (9999, 10000)],
)
def test_highlight_degrades_to_plain_text_on_bad_offsets(start, end):
    """A drifted citation must degrade to page level, never break the screen.

    Relevant right now: the extraction task does not populate char_start/char_end yet,
    so real assertions arrive with NULL offsets.
    """
    html = ar.highlight("some page text", start, end)
    assert "<mark>" not in html
    assert "some page text" in html


# --- the four outcomes ----------------------------------------------------

def test_every_outcome_renders_a_glyph_and_a_word():
    """WCAG 2.2 SC 1.4.1: colour may never be the only carrier of meaning."""
    for outcome, word in [
        ("pass", "Pass"), ("fail", "Fail"),
        ("not_evaluated", "Not evaluated"), ("conflicting", "Conflicting"),
    ]:
        html = ar.claim_header({"outcome": outcome})
        assert word in html, outcome
        assert "sa-status-glyph" in html, outcome


def test_not_evaluated_is_dashed_and_conflicting_is_doubled():
    """The border style is what survives greyscale, so it must differ per outcome."""
    assert "dashed" in ar.claim_header({"outcome": "not_evaluated"})
    assert "double" in ar.claim_header({"outcome": "conflicting"})


def test_unknown_outcome_raises_rather_than_defaulting_to_pass():
    with pytest.raises(ValueError, match="never default to pass"):
        ar.claim_header({"outcome": "probably_fine"})


def test_claim_header_cites_rule_id_and_version(conflicting):
    html = ar.claim_header(conflicting["claims"][1])
    assert "SURV-LVEF-001" in html
    assert "v2" in html   # "the rule said so" is unverifiable without the version


# --- R1: a computed value must never look printed -------------------------

def test_derivation_shows_the_arithmetic_and_disclaims_the_page(supported):
    structured = supported["claims"][0]["evidence"][0]
    html = ar.derivation(structured)
    assert "Derived, not printed." in html
    assert "6000" in html                              # the arithmetic is shown
    assert "appears nowhere on the page" in html       # and the page is disclaimed


def test_no_derivation_block_when_nothing_was_computed():
    assert ar.derivation({"kind": "structured", "id": "X", "table": "T"}) == ""


def test_structured_evidence_carries_all_three_r2_clocks(supported):
    html = ar.evidence_block(supported["claims"][0]["evidence"][0])
    for label in ("Event", "Recorded", "Ingested"):
        assert label in html


# --- R6: patient and reference evidence must never look alike -------------

def test_patient_and_reference_evidence_get_different_classes(supported):
    patient = ar.evidence_block(supported["claims"][0]["evidence"][0])
    reference = ar.evidence_block({
        "kind": "reference_clause", "id": "R1", "doc_id": "D1",
        "page_index": 0, "publisher": "NCCN", "effective_date": "2026-01-01",
    })
    assert "sa-ev-patient" in patient
    assert "sa-ev-reference" in reference
    # Not colour alone - the word says which it is.
    assert "not patient data" in reference


def test_unknown_evidence_kind_raises():
    with pytest.raises(ValueError, match="unknown evidence kind"):
        ar.evidence_block({"kind": "vibes", "id": "X"})


# --- R7: never a percentage ----------------------------------------------

def test_verification_renders_as_words_not_numbers(conflicting):
    html = ar.evidence_block(conflicting["claims"][0]["evidence"][0])
    assert "one read only" in html
    assert "%" not in html


def test_conflicting_read_says_the_value_is_not_asserted():
    html = ar.evidence_block({
        "kind": "document_span", "id": "A", "doc_id": "D", "page_index": 0,
        "char_start": 0, "char_end": 1, "verification_status": "conflicting",
    })
    assert "not asserted" in html
    assert "not_evaluated" in html


def test_page_index_is_shown_one_based(supported):
    """DOC_PAGE is 0-based; a reader expects page 2, not page 1."""
    span = supported["claims"][0]["evidence"][1]
    assert span["page_index"] == 1
    assert "page 2" in ar.evidence_block(span)


# --- masthead: authority and cutoff are not footnotes ---------------------

def test_masthead_states_consent_and_known_as_of():
    html = ar.masthead(
        patient_name="P", practitioner_name="Dr M",
        consent_id="CON-0031", known_as_of="2026-09-18T09:00:00",
    )
    assert "CON-0031" in html
    assert "18 Sep 2026, 09:00" in html


def test_masthead_says_none_rather_than_hiding_a_missing_consent():
    html = ar.masthead(
        patient_name="P", practitioner_name="Dr M",
        consent_id=None, known_as_of="2026-09-18T09:00:00",
    )
    assert "none" in html


def test_unbound_masthead_refuses_to_look_ready():
    html = ar.unbound_masthead()
    assert "No patient bound" in html
    assert "Bind Patient" in html


def test_bad_timestamp_is_passed_through_not_mangled():
    html = ar.masthead(
        patient_name="P", practitioner_name="D", consent_id="C", known_as_of="not-a-time",
    )
    assert "not-a-time" in html


# --- Class A --------------------------------------------------------------

def test_refusal_names_the_practitioner_and_registration(class_a):
    html = ar.refusal_block(class_a["refusal"])
    assert "Dr A. Rao" in html
    assert "KMC-2009-41882" in html
    # Framed as a referral, not an error the user caused.
    assert "referred" in html


def test_packet_confirmation_is_addressed_to_a_named_practitioner(class_a):
    html = ar.packet_confirmation(
        packet_id="EVP-DEADBEEF", practitioner=class_a["refusal"]["practitioner"],
    )
    assert "EVP-DEADBEEF" in html
    assert "Dr A. Rao" in html
    assert "KMC-2009-41882" in html


# --- provenance and action ------------------------------------------------

def test_provenance_note_is_rendered_when_present(conflicting):
    html = ar.provenance(conflicting["claims"][1])
    assert "FDA label" in html


def test_no_provenance_block_when_absent():
    assert ar.provenance({"text": "x"}) == ""


def test_action_is_rendered_when_present(conflicting):
    assert "echocardiogram" in ar.action(conflicting["claims"][1])


def test_no_action_block_when_absent(supported):
    assert ar.action(supported["claims"][0]) == ""


# --- R3: missingness states must stay distinguishable ---------------------

def test_not_received_and_explicitly_negative_render_differently():
    """"Not received" is never "negative" - conflating them is a clinical error."""
    assert ar.missingness_badge("not_received") != ar.missingness_badge("explicitly_negative")
    assert "not received" in ar.missingness_badge("not_received")
