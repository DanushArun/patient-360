"""FHIR R4 bundle — the semi-structured ingestion path. WORK-PLAN.md Day 1-2,
Contract 5. Produces one `Bundle` per ledger for `RAW_FHIR_BUNDLE`.

Two traps this generator deliberately seeds so the later flatten_fhir.sql
task (Day 7-8) has real data to fail against, not a synthetic case invented
after the bug was already found (SPEC.md 323, 473):

  - `effective[x]` is a FHIR *choice type* — exactly one variant is present
    per resource. A reader that only checks `effectiveDateTime` silently
    drops every observation recorded as `effectivePeriod`, so this builder
    emits both variants across different events, never both on one resource.
  - The two R2 clocks on an `Observation` are the standard's own fields:
    `effectiveDateTime` (event_time) and `issued` (source_recorded_at) — not
    a field invented for this project. `Procedure` and `MedicationAdministration`
    have no `issued` equivalent in base R4, so `meta.lastUpdated` stands in
    for the record clock there.
"""

from __future__ import annotations

from data.generator.ledger import ClinicalEvent, Ledger

_IDENTIFIER_SYSTEM_URI = {
    "MRN": "urn:oid:saarthi:mrn",
    "UHID": "urn:oid:saarthi:uhid",
    "LAB_ACCESSION_ID": "urn:oid:saarthi:lab-accession",
    "INSURANCE_MEMBER_ID": "urn:oid:saarthi:insurance-member-id",
}


def _patient_resource(ledger: Ledger) -> dict:
    return {
        "resourceType": "Patient",
        "id": ledger.patient_id,
        "identifier": [
            {
                "system": _IDENTIFIER_SYSTEM_URI.get(ident.system, f"urn:oid:saarthi:{ident.system.lower()}"),
                "value": ident.value,
            }
            for ident in ledger.identifiers
        ],
    }


def _her2_observation(event: ClinicalEvent) -> dict:
    return {
        "resourceType": "Observation",
        "id": event.event_id,
        "status": "final",
        "code": {"text": "HER2"},
        "effectiveDateTime": event.event_time.isoformat(),
        "issued": event.source_recorded_at.isoformat(),
        "specimen": {"display": event.specimen_id},
        "component": [
            {"code": {"text": "specimen source"}, "valueString": event.specimen_source},
            {"code": {"text": "grade"}, "valueString": event.grade},
            {"code": {"text": "IHC score"}, "valueString": event.ihc_score},
        ],
    }


def _dexa_observation(event: ClinicalEvent) -> dict:
    # Deliberately effectivePeriod, not effectiveDateTime — see module docstring.
    return {
        "resourceType": "Observation",
        "id": event.event_id,
        "status": "final",
        "code": {"text": "DEXA T-score"},
        "effectivePeriod": {"start": event.event_time.isoformat()},
        "issued": event.source_recorded_at.isoformat(),
        "valueQuantity": {"value": event.t_score, "unit": "T-score"},
    }


def _procedure(event: ClinicalEvent, text: str) -> dict:
    return {
        "resourceType": "Procedure",
        "id": event.event_id,
        "status": "completed",
        "code": {"text": text},
        "performedDateTime": event.event_time.isoformat(),
        "meta": {"lastUpdated": event.source_recorded_at.isoformat()},
    }


def _medication_administration(event: ClinicalEvent, text: str) -> dict:
    return {
        "resourceType": "MedicationAdministration",
        "id": event.event_id,
        "status": "completed",
        "medicationCodeableConcept": {"text": text},
        "effectiveDateTime": event.event_time.isoformat(),
        "meta": {"lastUpdated": event.source_recorded_at.isoformat()},
    }


_EVENT_BUILDERS = {
    "chemo_cycle": lambda e: _procedure(e, "Chemotherapy administration"),
    "appendectomy": lambda e: _procedure(e, "Appendectomy"),
    "her2_result": _her2_observation,
    "dexa_scan": _dexa_observation,
    "zoledronic_acid_infusion": lambda e: _medication_administration(e, "Zoledronic acid"),
}


def _event_resource(event: ClinicalEvent) -> dict:
    builder = _EVENT_BUILDERS.get(event.kind)
    if builder is None:
        raise ValueError(f"no FHIR mapping for event kind {event.kind!r}")
    return builder(event)


def build_fhir_bundle(ledger: Ledger) -> dict:
    """Returns a FHIR R4 `Bundle` (JSON-serializable dict) for the ledger."""
    resources = [_patient_resource(ledger)] + [
        _event_resource(event) for event in sorted(ledger.events, key=lambda e: e.event_time)
    ]
    return {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
            {"fullUrl": f"urn:uuid:{resource['id']}", "resource": resource}
            for resource in resources
        ],
    }
