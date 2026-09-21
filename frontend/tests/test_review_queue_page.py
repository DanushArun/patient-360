"""Tests for frontend/pages/2_Review_Queue.py — README: "open gate failures
by urgency; the unowned gap." Fixture deliberately mixes severities, ties,
a closed issue, and an escalated issue so ordering and exclusion are both
provable, not just plausible.
"""

from __future__ import annotations

from pathlib import Path

from streamlit.testing.v1 import AppTest

_PAGE_PATH = Path(__file__).resolve().parent.parent / "pages" / "2_Review_Queue.py"


def _run_page() -> AppTest:
    at = AppTest.from_file(str(_PAGE_PATH))
    at.run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_page_title():
    at = _run_page()
    assert at.title[0].value == "Review Queue"


def test_closed_and_escalated_issues_do_not_appear():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    assert "Patient Seventy" not in body    # closed
    assert "Patient Eighty-Two" not in body  # escalated


def test_most_urgent_issue_appears_before_less_urgent_ones():
    at = _run_page()
    body = "\n".join(m.value for m in at.markdown)
    # RI-001 (days_to_visit=2, blocker) must precede RI-002 (days_to_visit=7)
    assert body.index("Patient (deep case)") < body.index("Patient Fifty-Five")


def test_unowned_issue_is_visibly_flagged():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    assert "unassigned" in body.lower() or "unowned" in body.lower()


def test_assigned_issue_names_its_owner():
    at = _run_page()
    body = " ".join(m.value for m in at.markdown)
    assert "Dr. Meera Iyer" in body
