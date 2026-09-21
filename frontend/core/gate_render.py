"""4-outcome gate display — SPEC.md 356/487, WORK-PLAN.md 503.

Five gates (clinical, safety, documentation, coverage, identity), each a
4-valued outcome — never a boolean. `not_evaluated` is deliberately not
styled as a failure: "a missing lab does not mean ANC is low, it means we
do not know" (WORK-PLAN.md 503), and collapsing the two destroys the
distinction R3 exists to protect. `conflicting` gets its own severity too —
two disagreeing sources is not the same fact as a rule that failed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

_OUTCOME_STYLE = {
    "pass": ("Pass", "good"),
    "fail": ("Fail", "bad"),
    "not_evaluated": ("Not evaluated", "neutral"),
    "conflicting": ("Conflicting", "warn"),
}


@dataclass(frozen=True)
class GateDescription:
    gate: str
    label: str
    severity: str
    detail: str


def describe_gate(result: dict[str, Any]) -> GateDescription:
    outcome = result["outcome"]
    if outcome not in _OUTCOME_STYLE:
        raise ValueError(f"unknown gate outcome {outcome!r} — never default to pass")

    label, severity = _OUTCOME_STYLE[outcome]
    detail = f"{result['rule_id']} v{result['rule_version']}"
    provenance_note = result.get("provenance_note")
    if provenance_note:
        detail += f" · {provenance_note}"

    return GateDescription(gate=result["gate"], label=label, severity=severity, detail=detail)
