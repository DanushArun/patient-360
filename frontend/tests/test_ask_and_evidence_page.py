"""Tests for frontend/pages/1_Ask_and_Evidence.py — WORK-PLAN.md Day 1:
"Build the entire UI against a hard-coded fixture answer. Do not wait for
Stream 2." Uses Streamlit's own `AppTest` (streamlit.testing.v1) to run the
real page script and assert on what it actually renders — not a mock of
Streamlit, the real script executed headless.

Scope for this first slice: the CLASS_B supported-answer fixture, per-claim
rendering, known_as_of, and the evidence pane opening on click for both
patient-evidence kinds (structured, document_span) present in that fixture.
Class A refusal and reference_clause rendering are separate follow-on
features, tracked in IMPLEMENTATION-STATUS.md, not silently assumed here.
"""

from __future__ import annotations

from pathlib import Path

from streamlit.testing.v1 import AppTest

_PAGE_PATH = Path(__file__).resolve().parent.parent / "pages" / "1_Ask_and_Evidence.py"


def _run_page() -> AppTest:
    at = AppTest.from_file(str(_PAGE_PATH))
    at.run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_page_title_is_ask_and_evidence():
    at = _run_page()
    assert at.title[0].value == "Ask + Evidence"


def test_page_shows_a_question_input():
    at = _run_page()
    assert len(at.text_input) == 1


def test_page_states_known_as_of():
    at = _run_page()
    captions = [c.value for c in at.caption]
    assert any("2026-09-18T09:00:00" in c for c in captions)


def test_page_shows_the_claim_text():
    at = _run_page()
    markdown_text = " ".join(m.value for m in at.markdown)
    assert "ANC is 2100" in markdown_text


def test_evidence_is_hidden_until_the_button_is_clicked():
    at = _run_page()
    markdown_text = " ".join(m.value for m in at.markdown)
    assert "CLINICAL_EVENT" not in markdown_text
    assert "DOC-0052" not in markdown_text


def test_clicking_show_evidence_reveals_the_structured_row_with_its_derivation():
    at = _run_page()
    at.button[0].click().run()
    assert not at.exception, [e.value for e in at.exception]

    info_text = " ".join(i.value for i in at.info)
    assert "CLINICAL_EVENT" in info_text
    assert "CE-LAB-441" in info_text
    # R1: a computed value must never look printed - the derivation note is
    # part of the same info panel, not a detail a reader could miss.
    assert "Derived:" in info_text


def test_clicking_show_evidence_reveals_the_document_span_with_page_and_status():
    at = _run_page()
    at.button[0].click().run()

    warning_text = " ".join(w.value for w in at.warning)
    assert "DOC-0052" in warning_text
    assert "page 2" in warning_text  # page_index 1 -> 1-based page 2
    assert "verified" in warning_text.lower()


def test_clicking_show_evidence_again_hides_it():
    at = _run_page()
    at.button[0].click().run()
    at.button[0].click().run()
    info_text = " ".join(i.value for i in at.info)
    assert "CLINICAL_EVENT" not in info_text
