"""Build a FHIR R4 Bundle from the current DB state for any patient.

Companion to `fhir_bundles.py`. The ledger-shaped builder is the source of
truth for the deep case (`PAT-DEEP-0001`); this DB-shaped builder covers
every patient in `SAARTHI.CORE.PATIENT`, including those seeded via SQL
(the 11 daycare cohort patients) that never had a Ledger to project from.

Design notes:
    - Pure functions. IO (querying Snowflake, writing files) lives in
      `backend/scripts/generate_fhir_bundles.py`. This module takes plain
      dicts + lists and returns a bundle dict - unit-testable without a
      Snowflake account.
    - Symmetry with `flatten_fhir.sql`. Every resourceType this emits must
      appear in the CASE expression of the flatten proc, or the round trip
      silently drops resources. Enforced by `_fhir_common.EVENT_TYPE_TO_RESOURCE`
      staying in step with `flatten_fhir.sql:66-73`.
    - Two R2 clocks. `effectiveDateTime` = event_time, `issued` =
      source_recorded_at, exactly like the Ledger-shaped builder. Where the
      resource type has no `issued` (Procedure, MedicationAdministration,
      Condition), we use `meta.lastUpdated`, matching `fhir_bundles.py`.
    - Deterministic ordering. Resources within a bundle are sorted by
      event_time then event_id so the same DB state always yields byte-
      identical JSON, which matters for downstream idempotency checks and
      any diff-based judge inspection.
"""
from __future__ import annotations

from typing import Any

from data.generator._fhir_common import EVENT_TYPE_TO_RESOURCE, system_uri


def _patient_resource(patient_id: str, id_map_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Emit a FHIR Patient resource. Identifiers come from ID_MAP, one entry
    per (system, value) - which mirrors the multi-facility identifier reality
    the deep case's real record had (7 identifiers across 4 facilities, zero
    ABHA - a fact that must survive every export)."""
    return {
        "resourceType": "Patient",
        "id": patient_id,
        "identifier": [
            {
                "system": system_uri(row["SYSTEM"]),
                "value": row["VALUE"],
            }
            for row in id_map_rows
        ],
    }


def _observation(event: dict[str, Any]) -> dict[str, Any]:
    """Observation for lab / vitals / imaging / staging. Follows the
    effectiveDateTime + issued two-clock convention. `valueQuantity` only
    emitted when value_num is populated - some observations (HER2 IHC in
    the DC cohort) carry only a code and are typed by that alone."""
    resource: dict[str, Any] = {
        "resourceType": "Observation",
        "id": event["EVENT_ID"],
        "status": event.get("STATUS") or "final",
        "code": {
            "coding": [{
                "system": event.get("CODE_SYSTEM") or "http://loinc.org",
                "code": event.get("CODE") or "",
                "display": event.get("DISPLAY") or "",
            }],
            "text": event.get("DISPLAY") or "",
        },
    }
    if event.get("EVENT_TIME"):
        resource["effectiveDateTime"] = _iso(event["EVENT_TIME"])
    if event.get("SOURCE_RECORDED_AT"):
        resource["issued"] = _iso(event["SOURCE_RECORDED_AT"])
    if event.get("VALUE_NUM") is not None:
        resource["valueQuantity"] = {
            "value": float(event["VALUE_NUM"]),
            "unit": event.get("UNIT") or "",
        }
    return resource


def _diagnostic_report(event: dict[str, Any]) -> dict[str, Any]:
    """DiagnosticReport for pathology. `issued` maps to source_recorded_at
    per R2; `effectiveDateTime` uses the clinical clock."""
    return {
        "resourceType": "DiagnosticReport",
        "id": event["EVENT_ID"],
        "status": event.get("STATUS") or "final",
        "code": {
            "coding": [{
                "system": event.get("CODE_SYSTEM") or "http://loinc.org",
                "code": event.get("CODE") or "",
                "display": event.get("DISPLAY") or "",
            }],
            "text": event.get("DISPLAY") or "",
        },
        "effectiveDateTime": _iso(event["EVENT_TIME"]) if event.get("EVENT_TIME") else None,
        "issued": _iso(event["SOURCE_RECORDED_AT"]) if event.get("SOURCE_RECORDED_AT") else None,
    }


def _condition(event: dict[str, Any]) -> dict[str, Any]:
    """Condition for diagnosis events. No `issued` in base R4 Condition, so
    the record-clock lives on meta.lastUpdated - same convention the ledger-
    shaped builder uses for Procedure and MedicationAdministration."""
    resource: dict[str, Any] = {
        "resourceType": "Condition",
        "id": event["EVENT_ID"],
        "code": {
            "coding": [{
                "system": event.get("CODE_SYSTEM") or "http://hl7.org/fhir/sid/icd-10",
                "code": event.get("CODE") or "",
                "display": event.get("DISPLAY") or "",
            }],
            "text": event.get("DISPLAY") or "",
        },
    }
    if event.get("EVENT_TIME"):
        resource["recordedDate"] = _iso(event["EVENT_TIME"])
    if event.get("SOURCE_RECORDED_AT"):
        resource["meta"] = {"lastUpdated": _iso(event["SOURCE_RECORDED_AT"])}
    return resource


def _medication_administration(event: dict[str, Any]) -> dict[str, Any]:
    """MedicationAdministration for medication events. `effectiveDateTime`
    is the clinical clock; meta.lastUpdated carries the record clock (base
    R4 has no `issued` on MedicationAdministration)."""
    resource: dict[str, Any] = {
        "resourceType": "MedicationAdministration",
        "id": event["EVENT_ID"],
        "status": event.get("STATUS") or "completed",
        "medicationCodeableConcept": {
            "coding": [{
                "system": event.get("CODE_SYSTEM") or "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": event.get("CODE") or "",
                "display": event.get("DISPLAY") or "",
            }],
            "text": event.get("DISPLAY") or "",
        },
    }
    if event.get("EVENT_TIME"):
        resource["effectiveDateTime"] = _iso(event["EVENT_TIME"])
    if event.get("SOURCE_RECORDED_AT"):
        resource["meta"] = {"lastUpdated": _iso(event["SOURCE_RECORDED_AT"])}
    return resource


_RESOURCE_BUILDERS = {
    "Observation": _observation,
    "DiagnosticReport": _diagnostic_report,
    "Condition": _condition,
    "MedicationAdministration": _medication_administration,
}


def _iso(value: Any) -> str:
    """Coerce a Snowflake timestamp string / datetime into ISO-8601 without
    the Snowflake-specific fractional-second formatting."""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    s = str(value).strip()
    # Snowflake JSON output wraps timestamps in extra quotes sometimes
    if s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
    # Trim trailing '.000' for cleaner FHIR output
    if "." in s and s.endswith(".000"):
        s = s[:-4]
    return s.replace(" ", "T")


def _event_resource(event: dict[str, Any]) -> dict[str, Any] | None:
    """Dispatch an event row to the right FHIR resource builder. Returns
    None for event types with no FHIR analogue (treatment_plan_change) -
    caller filters None out. Raises on unknown event_type to fail loud
    rather than silently drop rows."""
    event_type = event.get("EVENT_TYPE")
    resource_type = EVENT_TYPE_TO_RESOURCE.get(event_type)
    if resource_type is None:
        # explicitly None in the map = skip; missing entirely = fail loud
        if event_type in EVENT_TYPE_TO_RESOURCE:
            return None
        raise ValueError(f"no FHIR mapping for event_type {event_type!r}; extend _fhir_common.EVENT_TYPE_TO_RESOURCE")
    builder = _RESOURCE_BUILDERS[resource_type]
    return builder(event)


def build_fhir_bundle_from_db(
    patient_id: str,
    id_map_rows: list[dict[str, Any]],
    clinical_events: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return a FHIR R4 `Bundle` dict for `patient_id`, sourced from DB rows.

    Args:
        patient_id: `PATIENT.patient_id`.
        id_map_rows: list of dicts with keys SYSTEM, VALUE (from ID_MAP query).
        clinical_events: list of dicts from CLINICAL_EVENT with the columns
            selected by fetch_events_for_patient in generate_fhir_bundles.py.

    Resources are ordered Patient-first, then all events sorted by
    (event_time, event_id) - deterministic for byte-identical bundle
    regeneration.
    """
    resources: list[dict[str, Any]] = [_patient_resource(patient_id, id_map_rows)]

    sorted_events = sorted(
        clinical_events,
        key=lambda e: (str(e.get("EVENT_TIME") or ""), e.get("EVENT_ID") or ""),
    )
    for event in sorted_events:
        resource = _event_resource(event)
        if resource is not None:
            resources.append(resource)

    return {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
            {"fullUrl": f"urn:uuid:{r['id']}", "resource": r}
            for r in resources
        ],
    }
