"""Tests for frontend/pages/0_Bind_Patient.py — COPILOT-SPEC.md 0's step 0:
"Coordinator signs in, picks the patient from a care-team-filtered list.
Header shows the binding."
"""

from __future__ import annotations

from pathlib import Path

from streamlit.testing.v1 import AppTest

_PAGE_PATH = Path(__file__).resolve().parent.parent / "pages" / "0_Bind_Patient.py"


def _run_page() -> AppTest:
    at = AppTest.from_file(str(_PAGE_PATH))
    at.run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_page_title():
    at = _run_page()
    assert at.title[0].value == "Bind Patient"


def test_picker_only_lists_authorised_patients():
    at = _run_page()
    options = at.selectbox[0].options
    assert "Patient (deep case)" in options
    assert "Patient (different care team)" not in options
    assert "Patient (consent expired)" not in options


def test_no_binding_shown_before_a_selection_is_confirmed():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    assert "Bound to" not in body


def test_confirming_the_picker_shows_a_persistent_binding_header():
    at = _run_page()
    at.selectbox[0].select("Patient (deep case)").run()
    at.button[0].click().run()
    assert not at.exception, [e.value for e in at.exception]

    body = " ".join(m.value for m in at.markdown)
    assert "Bound to" in body
    assert "Patient (deep case)" in body
    assert "Dr. Meera Iyer" in body


def test_binding_header_states_the_consent_backing_it():
    at = _run_page()
    at.selectbox[0].select("Patient (deep case)").run()
    at.button[0].click().run()
    body = " ".join(m.value for m in at.markdown)
    assert "CON-0031" in body
