"""Tests for frontend/pages/3_Patient_360.py — the gate strip.

SPEC.md 10: "2-minute chart review." 5 gates, all four outcomes must be
visually distinguishable — this fixture deliberately carries one of each
(pass/fail/not_evaluated/conflicting) so the strip can't accidentally pass
its tests by only ever having seen `pass`.
"""

from __future__ import annotations

from pathlib import Path

from streamlit.testing.v1 import AppTest

_PAGE_PATH = Path(__file__).resolve().parent.parent / "pages" / "3_Patient_360.py"


def _run_page() -> AppTest:
    at = AppTest.from_file(str(_PAGE_PATH))
    at.run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_page_title():
    at = _run_page()
    assert at.title[0].value == "Patient 360"


def test_all_five_gates_are_shown():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    for gate in ("clinical", "safety", "documentation", "coverage", "identity"):
        assert gate in body.lower()


def test_all_four_outcomes_are_shown_with_their_rule_ids():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    assert "CLIN-ANC-001" in body and "Pass" in body
    assert "SURV-LVEF-001" in body and "Fail" in body
    assert "DOC-HER2-001" in body and "Not evaluated" in body
    assert "COV-AUTH-001" in body and "Conflicting" in body


def test_not_evaluated_gate_is_never_labelled_as_a_failure():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    # The not_evaluated gate's own line must say "Not evaluated", not "Fail" -
    # both words legitimately appear on the page (different gates), so check
    # they're not on the same line.
    her2_lines = [line for line in body.split("  ") if "DOC-HER2-001" in line]
    assert her2_lines and all("Fail" not in line for line in her2_lines)


def test_known_as_of_is_stated():
    at = _run_page()
    captions = [c.value for c in at.caption]
    assert any("2026-09-18T09:00:00" in c for c in captions)


def test_conflicting_gate_shows_its_provenance_note():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    assert "NHCX / IRDAI" in body
