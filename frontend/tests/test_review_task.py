"""Tests for frontend/core/review_task.py — SPEC.md 373/601/605,
WORK-PLAN.md 567: "create_review_task — the only write tool. Idempotent via
idempotency_key. Restricted to treating|coordinator — patient_navigator
cannot create tasks." SPEC.md 605: "action is an enum; 'approve treatment'
does not exist as a value" — R1 drawn as a literal enum boundary: this tool
can create a documentation task, never a clinical decision.
"""

from __future__ import annotations

import pytest

from frontend.core.review_task import ReviewTask, create_review_task


def test_coordinator_can_create_a_task():
    task = create_review_task(
        [], issue_id="RI-001", action="request_evidence", reason="Need the final FISH report.",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-001",
    )
    assert isinstance(task, ReviewTask)
    assert task.issue_id == "RI-001"
    assert task.action == "request_evidence"


def test_treating_practitioner_can_create_a_task():
    task = create_review_task(
        [], issue_id="RI-001", action="mark_resolved", reason="Report received.",
        actor_practitioner_id="PRC-001", actor_role="treating", idempotency_key="IK-002",
    )
    assert task.action == "mark_resolved"


def test_patient_navigator_cannot_create_a_task():
    # WORK-PLAN.md 567, verbatim: "patient_navigator cannot create tasks."
    with pytest.raises(PermissionError, match="patient_navigator"):
        create_review_task(
            [], issue_id="RI-001", action="request_evidence", reason="x",
            actor_practitioner_id="PRC-009", actor_role="patient_navigator", idempotency_key="IK-003",
        )


def test_consulting_role_cannot_create_a_task_either():
    # Only treating|coordinator are named as allowed - consulting is a real
    # role_type (SPEC.md 103) but not one of the two.
    with pytest.raises(PermissionError):
        create_review_task(
            [], issue_id="RI-001", action="request_evidence", reason="x",
            actor_practitioner_id="PRC-009", actor_role="consulting", idempotency_key="IK-004",
        )


def test_approve_treatment_is_not_a_valid_action():
    # SPEC.md 605, the spec's own example of what must be rejected.
    with pytest.raises(ValueError, match="approve treatment"):
        create_review_task(
            [], issue_id="RI-001", action="approve treatment", reason="x",
            actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-005",
        )


def test_same_idempotency_key_returns_the_existing_task_not_a_duplicate():
    first = create_review_task(
        [], issue_id="RI-001", action="request_evidence", reason="x",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-SAME",
    )
    second = create_review_task(
        [first], issue_id="RI-001", action="request_evidence", reason="x",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-SAME",
    )
    assert first.task_id == second.task_id


def test_different_idempotency_key_creates_a_genuinely_new_task():
    first = create_review_task(
        [], issue_id="RI-001", action="request_evidence", reason="x",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-A",
    )
    second = create_review_task(
        [first], issue_id="RI-001", action="request_evidence", reason="x",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-B",
    )
    assert first.task_id != second.task_id


def test_task_state_starts_open():
    task = create_review_task(
        [], issue_id="RI-001", action="request_evidence", reason="x",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-006",
    )
    assert task.state == "open"


def test_created_at_is_injectable_for_deterministic_tests():
    from datetime import datetime

    fixed = datetime(2026, 9, 18, 9, 0, 0)
    task = create_review_task(
        [], issue_id="RI-001", action="request_evidence", reason="x",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-007",
        created_at=fixed,
    )
    assert task.history[0]["at"] == fixed.isoformat()


def test_history_records_the_reason_for_the_first_transition():
    task = create_review_task(
        [], issue_id="RI-001", action="request_evidence", reason="Need the final FISH report.",
        actor_practitioner_id="PRC-001", actor_role="coordinator", idempotency_key="IK-008",
    )
    assert task.history[0]["reason"] == "Need the final FISH report."
    assert task.history[0]["from_state"] is None
    assert task.history[0]["to_state"] == "open"
