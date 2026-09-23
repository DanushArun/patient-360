"""Tests for frontend/streamlit_app.py — the single-surface entry point.

No live Snowflake connection exists under test, so every run exercises the
offline/recorded path (`live=False`) — exactly the "honest fallback" the
module docstring describes. These tests check the wiring around that path:
binding and clearing reset conversation state, the input is gated on a
binding, and the offline path never claims to be live.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import streamlit as st
from streamlit.testing.v1 import AppTest

_APP_PATH = Path(__file__).resolve().parent.parent / "streamlit_app.py"


def _run_app() -> AppTest:
    # Force the offline path deterministically. Whether this succeeds or hangs
    # otherwise depends on whatever Snowflake credentials happen to be on the
    # machine running the suite (a real OAuth handshake with none available
    # locally) — exactly the kind of environment-dependent flake a test must
    # not have. The app's own honest-fallback contract is that ANY connection
    # failure means offline mode; this exercises precisely that contract.
    with patch.object(st, "connection", side_effect=RuntimeError("no connection in tests")):
        at = AppTest.from_file(str(_APP_PATH))
        at.run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_app_runs_offline_without_exception():
    at = _run_app()
    assert at.session_state["turns"] == []
    assert at.session_state["selected_evidence"] is None


def test_chat_input_disabled_until_a_patient_is_bound():
    at = _run_app()
    assert at.chat_input[0].disabled is True


def test_binding_the_demo_patient_enables_input_and_resets_state():
    at = _run_app()
    at.session_state["turns"] = [{"role": "user", "text": "stale question"}]
    at.session_state["selected_evidence"] = (0, "clinical")
    at.run()

    bind_button = next(b for b in at.button if "Meera Iyer" in b.label)
    bind_button.click().run()

    assert at.session_state["demo_binding"]["patient_id"] == "PAT-DEEP-0001"
    # COPILOT-SPEC 1: switching (here, establishing) a binding must not carry
    # a previous conversation or a pinned citation into the new context.
    assert at.session_state["turns"] == []
    assert at.session_state["selected_evidence"] is None
    assert at.chat_input[0].disabled is False


def test_clear_conversation_resets_turns_and_selection():
    at = _run_app()
    at.session_state["demo_binding"] = {
        "binding_id": "BND-0007", "patient_id": "PAT-DEEP-0001",
        "consent_id": "CON-0031", "patient_name": "Meera Iyer",
    }
    at.session_state["turns"] = [{"role": "user", "text": "a question"}]
    at.session_state["selected_evidence"] = (0, "safety")
    at.run()

    clear_button = next(b for b in at.sidebar.button if b.label == "Clear conversation")
    clear_button.click().run()

    assert at.session_state["turns"] == []
    assert at.session_state["selected_evidence"] is None


def test_two_rules_sharing_one_gate_category_do_not_crash_on_render():
    # Regression: a real GET_READINESS answer commonly carries several rules
    # under the same gate category (e.g. CLIN-ANC-001 and CLIN-PLT-001 are
    # both "clinical"). Keying the evidence-citation button on gate category
    # instead of rule_id crashed with StreamlitDuplicateElementKey the first
    # time this was exercised against a real answer — gate category is not
    # unique within a turn, only rule_id is.
    at = _run_app()
    at.session_state["demo_binding"] = {
        "binding_id": "BND-0007", "patient_id": "PAT-DEEP-0001",
        "consent_id": "CON-0031", "patient_name": "Meera Iyer",
    }
    at.session_state["turns"] = [{
        "role": "assistant", "text": "Two clinical gates on this answer.",
        "thinking": None, "tools": [], "suggested": [], "known_as_of": None,
        "error": None,
        "gates": [
            {"gate": "clinical", "outcome": "fail", "rule_id": "CLIN-ANC-001",
             "rule_version": 1, "evidence_ids": ["EVT-1"], "reason": "stale"},
            {"gate": "clinical", "outcome": "fail", "rule_id": "CLIN-PLT-001",
             "rule_version": 1, "evidence_ids": ["EVT-2"], "reason": "stale"},
        ],
    }]
    at.run()
    assert not at.exception, [e.value for e in at.exception]

    evidence_buttons = [b for b in at.button if b.label.startswith("Evidence")]
    assert len(evidence_buttons) == 2  # one per rule, not collapsed to one per category

    evidence_buttons[0].click().run()
    assert not at.exception, [e.value for e in at.exception]
    assert at.session_state["selected_evidence"] == (0, "CLIN-ANC-001")


def test_home_offline_shows_recorded_census_without_open_buttons():
    # Offline, the day-care list is a recorded snapshot: visible, but rows must
    # not be openable - binding a patient needs a live session.
    at = _run_app()
    assert not any(b.label == "Open" for b in at.button)


def test_family_checklist_view_renders_for_a_bound_patient():
    at = _run_app()
    at.session_state["demo_binding"] = {
        "binding_id": "BND-0007", "patient_id": "PAT-DEEP-0001",
        "consent_id": "CON-0031", "patient_name": "Meera Iyer",
    }
    at.run()
    at.segmented_control[0].set_value("Family checklist").run()
    assert not at.exception, [e.value for e in at.exception]
    # The chat input still renders - the family view is a mode, not a page.
    assert at.chat_input


def test_offline_notice_renders_through_the_design_system_not_a_raw_alert():
    at = _run_app()
    # The "not connected" and "binding refused" notices route through
    # ar.limitation() (st.html) now, not st.warning/st.error — a raw
    # Streamlit alert box would be the one place left looking like a
    # default Streamlit app rather than this app's own design system.
    assert not at.warning
    assert not at.error
