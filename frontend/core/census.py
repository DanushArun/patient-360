"""The day-care list: tomorrow's chemotherapy chairs, triaged.

Pure functions over READINESS_STATE rows - no Streamlit, no connection - so the
ordering and classification are unit-tested, not eyeballed.

Classification mirrors DT_REVIEW_QUEUE.queue_status exactly, so the home screen
and the review queue can never disagree about a patient:
    blocked   a blocker rule failed
    conflict  two sources disagree (any severity)
    waiting   a blocker could not be evaluated - evidence missing, not bad
    advisory  only advisory rules failed - treatable, flagged
    ready     nothing above
An advisory rule that could not be evaluated does not demote a patient: an
unscreened DEXA does not hold a chemotherapy chair.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

STATUS_ORDER = ("blocked", "conflict", "waiting", "advisory", "ready")

STATUS_LABEL = {
    "blocked": "Blocked",
    "conflict": "Conflict",
    "waiting": "Waiting on evidence",
    "advisory": "Ready · advisory",
    "ready": "Ready",
}

# Which gate outcome style each census status borrows, so the census reads in the
# same glyph + word + border vocabulary as every gate chip in the app.
STATUS_OUTCOME = {
    "blocked": "fail",
    "conflict": "conflicting",
    "waiting": "not_evaluated",
    "advisory": "pass",
    "ready": "pass",
}


@dataclass
class ChairRow:
    encounter_id: str
    patient_id: str
    name: str
    place: str
    language: str | None
    regimen: str | None
    cycle: int | None
    scheduled: str | None
    status: str
    headline_rule: str | None
    headline: str | None
    other_issues: int
    gates: list[dict[str, Any]] = field(default_factory=list)


def classify(gates: list[dict[str, Any]]) -> str:
    def has(outcome: str, severity: str | None = None) -> bool:
        return any(
            g.get("outcome") == outcome and (severity is None or g.get("severity") == severity)
            for g in gates
        )

    if has("fail", "blocker"):
        return "blocked"
    if has("conflicting"):
        return "conflict"
    if has("not_evaluated", "blocker"):
        return "waiting"
    if any(
        g.get("outcome") not in {"pass", "fail", "not_evaluated", "conflicting"}
        or (g.get("outcome") != "pass" and g.get("severity") not in {"blocker", "advisory"})
        for g in gates
    ):
        return "waiting"
    if has("fail", "advisory"):
        return "advisory"
    return "ready"


_ISSUE_RANK = {
    ("fail", "blocker"): 0,
    ("conflicting", "blocker"): 1,
    ("conflicting", "advisory"): 1,
    ("not_evaluated", "blocker"): 2,
    ("fail", "advisory"): 3,
    ("not_evaluated", "advisory"): 4,
}


def _issues(gates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gates that need attention, most consequential first."""
    ranked = [g for g in gates if (g.get("outcome"), g.get("severity")) in _ISSUE_RANK]
    return sorted(
        ranked,
        key=lambda g: (_ISSUE_RANK[(g["outcome"], g["severity"])], g.get("rule_id", "")),
    )


def _chair_from_encounter(encounter_id: str, enc: dict[str, Any]) -> ChairRow:
    meta, gates = enc["meta"], enc["gates"]
    if not gates:
        return ChairRow(
            encounter_id=encounter_id, patient_id=meta["patient_id"], name=meta["name"],
            place=", ".join(p for p in (meta.get("district"), meta.get("state")) if p),
            language=meta.get("language"), regimen=meta.get("regimen"),
            cycle=meta.get("cycle"), scheduled=meta.get("scheduled"), status="waiting",
            headline_rule=None,
            headline="Readiness has not been computed for this visit yet.",
            other_issues=0, gates=gates,
        )

    issues = _issues(gates)
    head = issues[0] if issues else None
    headline = head.get("reason") if head else None
    if not headline and head:
        headline = "An applicable rule needs review."
    if not headline and all(g.get("outcome") == "pass" for g in gates):
        headline = "Every applicable rule passes."
    if not headline:
        headline = "Some applicable rules could not be evaluated."
    place = ", ".join(p for p in (meta.get("district"), meta.get("state")) if p)
    return ChairRow(
        encounter_id=encounter_id, patient_id=meta["patient_id"], name=meta["name"],
        place=place, language=meta.get("language"), regimen=meta.get("regimen"),
        cycle=meta.get("cycle"), scheduled=meta.get("scheduled"),
        status=classify(gates), headline_rule=head.get("rule_id") if head else None,
        headline=headline, other_issues=max(len(issues) - 1, 0), gates=gates,
    )


def build_census(rows: list[dict[str, Any]]) -> list[ChairRow]:
    """Build a sorted row per encounter, retaining encounters without gate rows."""
    by_encounter: dict[str, dict[str, Any]] = {}
    for row in rows:
        enc = by_encounter.setdefault(row["encounter_id"], {"meta": row, "gates": []})
        if row.get("rule_id"):
            enc["gates"].append({
                "gate": row.get("gate"), "rule_id": row["rule_id"],
                "rule_version": row.get("rule_version"), "outcome": row.get("outcome"),
                "severity": row.get("severity"), "reason": row.get("reason"),
            })
    census = [_chair_from_encounter(key, enc) for key, enc in by_encounter.items()]
    census.sort(
        key=lambda chair: (
            STATUS_ORDER.index(chair.status), chair.scheduled or "", chair.name
        )
    )
    return census


def counts(census: list[ChairRow]) -> dict[str, int]:
    tally = {s: 0 for s in STATUS_ORDER}
    for row in census:
        tally[row.status] += 1
    return tally
