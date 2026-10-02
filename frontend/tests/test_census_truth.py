from types import SimpleNamespace
from typing import Any

from frontend.core import answer_render
from frontend.core.census import build_census, classify


def _row(
    outcome: str | None,
    severity: str | None = "advisory",
    reason: str | None = "DEXA screen is unavailable",
) -> dict[str, Any]:
    return {
        "encounter_id": "E-1", "patient_id": "P-1", "name": "Synthetic Patient",
        "district": "Gaya", "state": "Bihar", "language": "Hindi",
        "regimen": "FOLFOX", "cycle": 2, "scheduled": "2026-10-03T09:00:00",
        "rule_id": "ENDO-DEXA-001", "outcome": outcome, "severity": severity,
        "reason": reason,
    }


def test_advisory_not_evaluated_stays_ready_and_keeps_reason() -> None:
    [chair] = build_census([_row("not_evaluated"), _row("pass", "blocker", "All clear")])

    assert chair.status == "ready"
    assert chair.headline_rule == "ENDO-DEXA-001"
    assert chair.headline == "DEXA screen is unavailable"


def test_null_outcome_when_present_waits_instead_of_ready() -> None:
    [chair] = build_census([_row(None, "blocker", "Outcome missing")])

    assert chair.status == "waiting"
    assert chair.headline != "Every applicable rule passes."


def test_nonpass_with_unknown_severity_waits_instead_of_ready() -> None:
    [chair] = build_census([_row("fail", None, "Severity missing")])

    assert chair.status == "waiting"


def test_invalid_gate_with_advisory_failure_waits() -> None:
    gates = [_row("fail", "advisory"), _row(None, "blocker")]

    [chair] = build_census(gates)

    assert chair.status == "waiting"


def test_unknown_outcome_when_present_waits_instead_of_ready() -> None:
    assert classify([{"outcome": "unknown", "severity": "blocker"}]) == "waiting"


def test_only_explicit_passes_get_all_pass_headline() -> None:
    [chair] = build_census([_row("pass", "blocker", None)])

    assert chair.headline == "Every applicable rule passes."


def test_renderer_missing_headline_does_not_claim_every_rule_passes() -> None:
    row = SimpleNamespace(
        regimen=None, cycle=None, place="Gaya", language=None, headline=None,
        headline_rule=None, other_issues=0, status="waiting", name="Synthetic Patient",
    )

    rendered = answer_render.census_row(row)

    assert "Readiness details are unavailable." in rendered
    assert "Every applicable rule passes." not in rendered
