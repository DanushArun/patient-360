"""Tests for frontend/core/review_queue.py — SPEC.md 364 (REVIEW_ISSUE),
README: "Review Queue | coordinator, between cycles | open gate failures by
urgency."
"""

from __future__ import annotations

from frontend.core.review_queue import open_issues_by_urgency


def _issue(**overrides) -> dict:
    base = {
        "issue_id": "RI-001", "patient_id": "PAT-0001", "patient_name": "Patient One",
        "gate": "safety", "rule_id": "SURV-LVEF-001", "outcome": "fail",
        "state": "open", "severity": "blocker", "days_to_visit": 5,
        "owner_practitioner_name": None,
    }
    base.update(overrides)
    return base


def test_closed_and_escalated_issues_are_excluded():
    issues = [
        _issue(issue_id="RI-001", state="open"),
        _issue(issue_id="RI-002", state="closed"),
        _issue(issue_id="RI-003", state="escalated"),
    ]
    queue = open_issues_by_urgency(issues)
    assert {i["issue_id"] for i in queue} == {"RI-001"}


def test_evidence_received_issues_still_appear_the_task_is_not_closed_yet():
    issues = [_issue(issue_id="RI-001", state="evidence_received")]
    queue = open_issues_by_urgency(issues)
    assert len(queue) == 1


def test_sorted_by_days_to_visit_soonest_first():
    issues = [
        _issue(issue_id="RI-A", days_to_visit=10),
        _issue(issue_id="RI-B", days_to_visit=2),
        _issue(issue_id="RI-C", days_to_visit=5),
    ]
    queue = open_issues_by_urgency(issues)
    assert [i["issue_id"] for i in queue] == ["RI-B", "RI-C", "RI-A"]


def test_blocker_breaks_a_tie_ahead_of_advisory_at_the_same_days_to_visit():
    issues = [
        _issue(issue_id="RI-ADV", days_to_visit=3, severity="advisory"),
        _issue(issue_id="RI-BLK", days_to_visit=3, severity="blocker"),
    ]
    queue = open_issues_by_urgency(issues)
    assert [i["issue_id"] for i in queue] == ["RI-BLK", "RI-ADV"]


def test_unassigned_issues_are_flagged():
    issues = [_issue(issue_id="RI-001", owner_practitioner_name=None)]
    queue = open_issues_by_urgency(issues)
    assert queue[0]["is_unowned"] is True


def test_assigned_issues_are_not_flagged_as_unowned():
    issues = [_issue(issue_id="RI-001", owner_practitioner_name="Dr. Rao")]
    queue = open_issues_by_urgency(issues)
    assert queue[0]["is_unowned"] is False
