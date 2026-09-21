"""Patient selection — COPILOT-SPEC.md 0.

"A permitted set is not a subject." Selection is a human clicking a name in
a list filtered by care relationship and consent — never inferred from
question text, never chosen by the agent (that door is closed by
frontend/core/tools.py never taking a patient parameter at all, a later
feature).

This is the client-side picker filter and the binding record shape, NOT the
security boundary. The real boundary is `bind_patient.sql`, executed as
owner, re-validating CURRENT_USER() -> PRACTITIONER -> CARE_TEAM -> CONSENT
server-side — this module's `bind_patient()` mirrors that same logic so the
fixture-only demo has a real (if offline) authorization check to show,
never a decorative one, but it is not what a deployed system trusts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any


def _date_covers(as_of: date, active_from: str, active_to: str | None) -> bool:
    if date.fromisoformat(active_from) > as_of:
        return False
    if active_to is not None and date.fromisoformat(active_to) < as_of:
        return False
    return True


def _has_active_care_team_row(patient: dict[str, Any], practitioner_id: str, as_of: date) -> bool:
    return any(
        row["practitioner_id"] == practitioner_id and _date_covers(as_of, row["active_from"], row["active_to"])
        for row in patient["care_team"]
    )


def _has_valid_consent(patient: dict[str, Any], as_of: date) -> bool:
    consent = patient["consent"]
    return _date_covers(as_of, consent["valid_from"], consent["valid_to"])


def care_team_filtered_patients(
    patients: list[dict[str, Any]], practitioner_id: str, as_of: date,
) -> list[dict[str, Any]]:
    """The patient picker's contents: only patients with both an active
    CARE_TEAM row for this practitioner and currently-valid consent."""
    return [
        p for p in patients
        if _has_active_care_team_row(p, practitioner_id, as_of) and _has_valid_consent(p, as_of)
    ]


@dataclass(frozen=True)
class Binding:
    patient_id: str
    practitioner_id: str
    consent_id: str
    bound_at: date


def bind_patient(
    patients: list[dict[str, Any]], practitioner_id: str, patient_id: str, as_of: date,
) -> Binding:
    """Mirrors bind_patient.sql's validation for the offline demo. Raises
    PermissionError("no_patient_access") on any failure — deliberately the
    uniform error shape's own code name, and deliberately silent about
    which specific check failed, matching the contract's own disclosure
    rule: no_patient_access reveals nothing about why."""
    authorised = care_team_filtered_patients(patients, practitioner_id, as_of)
    match = next((p for p in authorised if p["patient_id"] == patient_id), None)
    if match is None:
        raise PermissionError("no_patient_access")

    return Binding(
        patient_id=patient_id, practitioner_id=practitioner_id,
        consent_id=match["consent"]["consent_id"], bound_at=as_of,
    )
