"""Review Queue ordering — SPEC.md 364 (REVIEW_ISSUE), README: "open gate
failures by urgency; the unowned gap."

Only `open` and `evidence_received` issues belong on the queue — `closed`
and `escalated` are done or have moved elsewhere. Ordered by days_to_visit
ascending (the soonest visit is the most urgent), with `blocker` breaking a
tie ahead of `advisory` at the same days_to_visit — a blocker gate stops
the visit; an advisory one does not.
"""

from __future__ import annotations

from typing import Any

_OPEN_STATES = frozenset({"open", "evidence_received"})
_SEVERITY_RANK = {"blocker": 0, "advisory": 1}


def open_issues_by_urgency(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    open_issues = [dict(i, is_unowned=i["owner_practitioner_name"] is None)
                   for i in issues if i["state"] in _OPEN_STATES]
    return sorted(
        open_issues,
        key=lambda i: (i["days_to_visit"], _SEVERITY_RANK.get(i["severity"], 99)),
    )
