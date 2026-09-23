"""Tests for frontend/core/census.py - the day-care list's triage.

The classification must match DT_REVIEW_QUEUE.queue_status exactly, and the
ordering must put the chair that will fail tomorrow at the top.
"""

from __future__ import annotations

import json
from pathlib import Path

from frontend.core import answer_render as ar
from frontend.core.census import build_census, classify, counts

_FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "daycare_census_recorded.json"


def _g(outcome, severity="blocker", rule="R-1", reason="r"):
    return {"gate": "clinical", "rule_id": rule, "outcome": outcome,
            "severity": severity, "reason": reason}


def _row(enc, name, **gate):
    base = {"encounter_id": enc, "patient_id": "P-" + enc, "name": name, "district": "Gaya",
            "state": "Bihar", "language": "Hindi", "regimen": "FOLFOX", "cycle": 5,
            "scheduled": "2026-09-24T09:30:00", "gate": "clinical", "rule_id": None}
    base.update(gate)
    return base


def test_blocker_fail_outranks_everything():
    assert classify([_g("fail"), _g("conflicting"), _g("not_evaluated")]) == "blocked"


def test_conflict_outranks_missing_evidence():
    assert classify([_g("conflicting"), _g("not_evaluated")]) == "conflict"


def test_missing_blocker_evidence_is_waiting_not_blocked():
    # R3: no CBC on record means we do not know - never shown as a failed CBC.
    assert classify([_g("not_evaluated"), _g("pass")]) == "waiting"


def test_advisory_failure_is_treatable_not_blocked():
    assert classify([_g("fail", "advisory"), _g("pass")]) == "advisory"


def test_unevaluated_advisory_does_not_demote_a_ready_patient():
    # An unscreened DEXA does not hold a chemotherapy chair.
    assert classify([_g("not_evaluated", "advisory"), _g("pass")]) == "ready"


def test_census_sorts_blocked_first_and_ready_last():
    rows = [
        _row("E1", "Ready Patient", rule_id="R-1", outcome="pass", severity="blocker"),
        _row("E2", "Blocked Patient", rule_id="R-1", outcome="fail", severity="blocker"),
        _row("E3", "Waiting Patient", rule_id="R-1", outcome="not_evaluated", severity="blocker"),
    ]
    names = [c.name for c in build_census(rows)]
    assert names == ["Blocked Patient", "Waiting Patient", "Ready Patient"]


def test_headline_is_the_most_consequential_issue_with_a_count_of_the_rest():
    rows = [
        _row("E1", "A", rule_id="ADV", outcome="fail", severity="advisory", reason="advisory"),
        _row("E1", "A", rule_id="BLK", outcome="fail", severity="blocker", reason="blocker"),
        _row("E1", "A", rule_id="MIS", outcome="not_evaluated", severity="blocker", reason="missing"),
    ]
    [chair] = build_census(rows)
    assert chair.headline_rule == "BLK"
    assert chair.other_issues == 2


def test_encounter_without_readiness_is_listed_as_waiting_not_dropped():
    [chair] = build_census([_row("E1", "Not Yet Computed")])
    assert chair.status == "waiting"
    assert "not been computed" in chair.headline


def test_counts_cover_every_status():
    rows = [_row("E1", "A", rule_id="R", outcome="fail", severity="blocker"),
            _row("E2", "B", rule_id="R", outcome="pass", severity="blocker")]
    tally = counts(build_census(rows))
    assert tally["blocked"] == 1 and tally["ready"] == 1 and sum(tally.values()) == 2


def test_recorded_fixture_triages_every_designed_blocker():
    rows = json.loads(_FIXTURE.read_text())["rows"]
    by_name = {c.name: c for c in build_census(rows)}
    assert by_name["Rakesh Kumar Yadav"].status == "blocked"   # CBC 11 days old
    assert by_name["Savitri Bai"].status == "waiting"          # no CBC at all
    assert by_name["Gopal Das"].status == "conflict"           # pre-auth vs letter
    assert by_name["Abdul Rahman"].status == "advisory"        # HbA1c only
    assert by_name["Sunita Devi"].status == "ready"


def test_census_row_escapes_patient_supplied_text():
    rows = [_row("E1", "<script>x</script>", rule_id="R", outcome="fail",
                 severity="blocker", reason="<b>bad</b>")]
    html = ar.census_row(build_census(rows)[0])
    assert "<script>" not in html and "&lt;script&gt;" in html
    assert "<b>bad</b>" not in html


def test_census_chip_carries_glyph_and_word_not_colour_alone():
    html = ar.census_chip("blocked")
    assert "sa-status-glyph" in html and "Blocked" in html
