"""Tests for frontend/core/gate_render.py — the 4-outcome gate display.

SPEC.md 356/487: 5 gates (clinical, safety, documentation, coverage,
identity), each a 4-valued outcome (pass|fail|not_evaluated|conflicting) —
never a boolean. ARCHITECTURE-DIAGRAMS.md's own colour convention keeps
`not_evaluated` visually distinct from `fail`: a missing lab is not a
failed one, and collapsing them would destroy the distinction R3 exists to
protect (WORK-PLAN.md 503: "not_evaluated is not fail").
"""

from __future__ import annotations

import pytest

from frontend.core.gate_render import describe_gate


def test_pass_outcome():
    result = describe_gate({"gate": "clinical", "outcome": "pass", "rule_id": "CLIN-ANC-001", "rule_version": 3})
    assert result.label == "Pass"
    assert result.severity == "good"


def test_fail_outcome():
    result = describe_gate({"gate": "safety", "outcome": "fail", "rule_id": "SURV-LVEF-001", "rule_version": 2})
    assert result.label == "Fail"
    assert result.severity == "bad"


def test_not_evaluated_outcome_is_not_styled_as_a_failure():
    # R3 / WORK-PLAN.md 503: "not_evaluated is not fail." A missing lab
    # means unknown, not low — the severity token must differ from `fail`.
    result = describe_gate({"gate": "documentation", "outcome": "not_evaluated", "rule_id": "DOC-HER2-001", "rule_version": 1})
    assert result.label == "Not evaluated"
    assert result.severity != "bad"
    assert result.severity == "neutral"


def test_conflicting_outcome_is_its_own_severity_not_a_failure():
    result = describe_gate({"gate": "coverage", "outcome": "conflicting", "rule_id": "COV-AUTH-001", "rule_version": 1})
    assert result.label == "Conflicting"
    assert result.severity == "warn"
    assert result.severity != "bad"


def test_every_outcome_carries_its_rule_id_and_version():
    result = describe_gate({"gate": "clinical", "outcome": "pass", "rule_id": "CLIN-ANC-001", "rule_version": 3})
    assert "CLIN-ANC-001" in result.detail
    assert "3" in result.detail


def test_provenance_note_surfaces_when_present():
    # A threshold marked practice-consensus must say so wherever it
    # surfaces (SURG-CLEAR-001's 21-day interval, ENDO-HBA1C-001, etc.) —
    # never silently presented as a guideline requirement.
    result = describe_gate({
        "gate": "documentation", "outcome": "fail", "rule_id": "SURG-CLEAR-001", "rule_version": 1,
        "provenance_note": "Practice consensus, not a guideline requirement.",
    })
    assert "Practice consensus" in result.detail


def test_never_renders_a_boolean_label():
    for outcome in ("pass", "fail", "not_evaluated", "conflicting"):
        result = describe_gate({"gate": "clinical", "outcome": outcome, "rule_id": "R-1", "rule_version": 1})
        assert result.label not in ("True", "False", "Yes", "No")


def test_unknown_outcome_raises_rather_than_defaulting_to_pass():
    # Fail closed: an unrecognised outcome must never quietly render as
    # reassuring green.
    with pytest.raises(ValueError):
        describe_gate({"gate": "clinical", "outcome": "not_a_real_outcome", "rule_id": "R-1", "rule_version": 1})
