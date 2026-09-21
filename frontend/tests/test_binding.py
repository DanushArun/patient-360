"""Tests for frontend/core/binding.py — patient selection, COPILOT-SPEC.md 0.

"A permitted set is not a subject." Selection is a human clicking a name in
a list filtered by care relationship and consent — never inferred from
question text, never chosen by the agent. This module is the client-side
picker filter and the binding record shape; it is NOT the security
boundary (that is bind_patient.sql's server-side re-validation against
CURRENT_USER() -> CARE_TEAM -> CONSENT). A picker that shows an
unauthorised name is a bad UX, not a breach, but it should still never
happen — good UX doesn't offer an option the server would just refuse.
"""

from __future__ import annotations

from datetime import date

import pytest

from frontend.core.binding import Binding, bind_patient, care_team_filtered_patients

_TODAY = date(2026, 9, 18)


def _patients() -> list[dict]:
    return [
        {
            "patient_id": "PAT-0001", "name": "Patient One",
            "care_team": [{"practitioner_id": "PRC-001", "active_from": "2026-01-01", "active_to": None}],
            "consent": {"consent_id": "CON-01", "purpose_code": "treatment", "valid_from": "2026-01-01", "valid_to": None},
        },
        {
            "patient_id": "PAT-0002", "name": "Patient Two",
            "care_team": [{"practitioner_id": "PRC-002", "active_from": "2026-01-01", "active_to": None}],
            "consent": {"consent_id": "CON-02", "purpose_code": "treatment", "valid_from": "2026-01-01", "valid_to": None},
        },
        {
            "patient_id": "PAT-0003", "name": "Patient Three (relationship ended)",
            "care_team": [{"practitioner_id": "PRC-001", "active_from": "2025-01-01", "active_to": "2026-06-01"}],
            "consent": {"consent_id": "CON-03", "purpose_code": "treatment", "valid_from": "2026-01-01", "valid_to": None},
        },
        {
            "patient_id": "PAT-0004", "name": "Patient Four (consent expired)",
            "care_team": [{"practitioner_id": "PRC-001", "active_from": "2026-01-01", "active_to": None}],
            "consent": {"consent_id": "CON-04", "purpose_code": "treatment", "valid_from": "2026-01-01", "valid_to": "2026-06-01"},
        },
    ]


def test_picker_shows_only_patients_with_an_active_care_team_row():
    visible = care_team_filtered_patients(_patients(), practitioner_id="PRC-001", as_of=_TODAY)
    visible_ids = {p["patient_id"] for p in visible}
    assert "PAT-0001" in visible_ids
    assert "PAT-0002" not in visible_ids  # belongs to a different practitioner


def test_picker_excludes_a_care_team_relationship_that_has_ended():
    visible = care_team_filtered_patients(_patients(), practitioner_id="PRC-001", as_of=_TODAY)
    visible_ids = {p["patient_id"] for p in visible}
    assert "PAT-0003" not in visible_ids


def test_picker_excludes_a_patient_with_expired_consent():
    visible = care_team_filtered_patients(_patients(), practitioner_id="PRC-001", as_of=_TODAY)
    visible_ids = {p["patient_id"] for p in visible}
    assert "PAT-0004" not in visible_ids


def test_bind_succeeds_for_an_authorised_patient():
    binding = bind_patient(_patients(), practitioner_id="PRC-001", patient_id="PAT-0001", as_of=_TODAY)
    assert isinstance(binding, Binding)
    assert binding.patient_id == "PAT-0001"
    assert binding.consent_id == "CON-01"
    assert binding.bound_at == _TODAY


def test_bind_raises_no_patient_access_for_a_patient_outside_the_care_team():
    # Matches WORK-PLAN.md's own test: "Practitioner 1 binds to Patient 2 ->
    # fails with no_patient_access."
    with pytest.raises(PermissionError, match="no_patient_access"):
        bind_patient(_patients(), practitioner_id="PRC-001", patient_id="PAT-0002", as_of=_TODAY)


def test_bind_raises_no_patient_access_for_an_ended_relationship():
    with pytest.raises(PermissionError, match="no_patient_access"):
        bind_patient(_patients(), practitioner_id="PRC-001", patient_id="PAT-0003", as_of=_TODAY)


def test_bind_raises_no_patient_access_for_expired_consent():
    with pytest.raises(PermissionError, match="no_patient_access"):
        bind_patient(_patients(), practitioner_id="PRC-001", patient_id="PAT-0004", as_of=_TODAY)


def test_bind_raises_for_a_patient_id_not_in_the_list_at_all():
    with pytest.raises(PermissionError, match="no_patient_access"):
        bind_patient(_patients(), practitioner_id="PRC-001", patient_id="PAT-9999", as_of=_TODAY)
