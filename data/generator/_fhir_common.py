"""Identifier system URIs and event-type -> FHIR resource mappings shared by
both the Ledger-shaped bundle builder (`fhir_bundles.py`) and the DB-shaped
bundle builder (`fhir_from_db.py`).

Kept in one place so `PAT-DEEP-0001` (ledger-generated) and `PAT-DC-04`
(direct-seeded) resolve to identical URIs in downstream tooling. Changing the
URI convention only requires editing this file.
"""
from __future__ import annotations

# Canonical identifier-system URIs. FHIR requires a system for every
# Identifier; we mint OID-shaped URIs under a project namespace rather than
# invent per-facility URLs, because the deep case's identifier types live
# across four facilities and hard-coding each would fan out unnecessarily.
IDENTIFIER_SYSTEM_URI: dict[str, str] = {
    "MRN": "urn:oid:saarthi:mrn",
    "UHID": "urn:oid:saarthi:uhid",
    "LAB_ACCESSION_ID": "urn:oid:saarthi:lab-accession",
    "INSURANCE_MEMBER_ID": "urn:oid:saarthi:insurance-member-id",
    "ABHA": "urn:oid:in.gov.abdm:abha",
}


def system_uri(system: str) -> str:
    """Look up the canonical URI for an identifier system, with a
    deterministic fallback so a system we haven't enumerated still emits a
    valid FHIR identifier - just under a project namespace."""
    return IDENTIFIER_SYSTEM_URI.get(system, f"urn:oid:saarthi:{system.lower()}")


# CLINICAL_EVENT.event_type -> FHIR R4 resourceType. Matches the CASE
# expression in flatten_fhir.sql so bundles emitted by fhir_from_db round-trip
# cleanly through the flatten task.
EVENT_TYPE_TO_RESOURCE: dict[str, str] = {
    "lab": "Observation",
    "vitals": "Observation",
    "imaging": "Observation",         # DEXA, LVEF - flatten_fhir maps ImagingStudy back to 'imaging' too, symmetry is 1:many upstream
    "pathology": "DiagnosticReport",
    "diagnosis": "Condition",
    "staging": "Observation",
    "medication": "MedicationAdministration",
    "treatment_plan_change": None,    # no direct FHIR analogue; skip in bundle emission
}
