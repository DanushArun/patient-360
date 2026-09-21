"""Tests for frontend/pages/4_Review_and_History.py — README: "create/
assign a documentation task, record status changes, source references,
audit trail." WORK-PLAN.md 567: create_review_task is the only write tool,
idempotent, restricted to treating|coordinator.
"""

from __future__ import annotations

from pathlib import Path

from streamlit.testing.v1 import AppTest

_PAGE_PATH = Path(__file__).resolve().parent.parent / "pages" / "4_Review_and_History.py"


def _run_page() -> AppTest:
    at = AppTest.from_file(str(_PAGE_PATH))
    at.run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_page_title():
    at = _run_page()
    assert at.title[0].value == "Review + History"


def test_issue_picker_lists_open_queue_issues():
    at = _run_page()
    options = at.selectbox[0].options
    assert any("Patient (deep case)" in o for o in options)


def test_creating_a_task_as_coordinator_succeeds_and_appears_in_history():
    at = _run_page()
    at.selectbox[1].select("coordinator").run()  # role selector
    at.text_input[0].set_value("Need the final FISH report.").run()
    at.button[0].click().run()
    assert not at.exception, [e.value for e in at.exception]

    body = " ".join(m.value for m in at.markdown) + " ".join(c.value for c in at.caption)
    assert "Need the final FISH report." in body
    assert "open" in body.lower()


def test_creating_a_task_as_patient_navigator_is_refused_visibly():
    at = _run_page()
    at.selectbox[1].select("patient_navigator").run()
    at.button[0].click().run()
    assert not at.exception, [e.value for e in at.exception]

    error_text = " ".join(e.value for e in at.error)
    assert "patient_navigator" in error_text


def test_clicking_create_task_twice_does_not_duplicate_the_history_entry():
    at = _run_page()
    at.selectbox[1].select("coordinator").run()
    at.button[0].click().run()
    at.button[0].click().run()
    assert not at.exception, [e.value for e in at.exception]

    body = " ".join(m.value for m in at.markdown)
    # The task id appears once per distinct task, not once per click.
    task_id_mentions = body.count("RT-")
    assert task_id_mentions == 1
