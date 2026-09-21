"""Tests for data/generator/fhir_bundles.py — the semi-structured ingestion path.

WORK-PLAN.md Day 1-2 / Contract 5: "One FHIR R4 bundle with Bundle.entry[] ->
RAW_FHIR_BUNDLE." SPEC.md 473 and 323 are the two traps this generator has
to seed correctly so the later flatten_fhir.sql task (Day 7-8) has real data
to fail against: `effective[x]` is a FHIR choice type (exactly one variant
present per resource, never both), and the two R2 clocks on an Observation
are `effectiveDateTime` (event_time) and `issued` (source_recorded_at) —
not two different fields invented for this project.
"""

from __future__ import annotations

import json

from data.generator.fhir_bundles import build_fhir_bundle
from data.generator.ledger import generate_deep_case

_LEDGER = generate_deep_case(seed=20260918)


def test_bundle_is_a_valid_r4_collection_shape():
    bundle = build_fhir_bundle(_LEDGER)
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"
    assert isinstance(bundle["entry"], list) and bundle["entry"]


def test_one_entry_per_clinical_event_plus_one_patient():
    bundle = build_fhir_bundle(_LEDGER)
    assert len(bundle["entry"]) == len(_LEDGER.events) + 1


def test_patient_resource_carries_every_ledger_identifier():
    bundle = build_fhir_bundle(_LEDGER)
    patient = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Patient")
    assert len(patient["identifier"]) == len(_LEDGER.identifiers)

    # FHIR `identifier.system` must be a URI, not the ledger's raw local
    # system name — check the values round-trip and every system is a URI,
    # not that the URI mapping is byte-identical to the ledger enum.
    got_values = {i["value"] for i in patient["identifier"]}
    want_values = {ident.value for ident in _LEDGER.identifiers}
    assert got_values == want_values
    assert all(i["system"].startswith("urn:") for i in patient["identifier"])

    # Same ledger system always maps to the same FHIR system URI.
    system_uri_by_ledger_system: dict[str, str] = {}
    for ident, fhir_ident in zip(
        sorted(_LEDGER.identifiers, key=lambda i: i.value),
        sorted(patient["identifier"], key=lambda i: i["value"]),
    ):
        assert ident.value == fhir_ident["value"]
        system_uri_by_ledger_system.setdefault(ident.system, fhir_ident["system"])
        assert system_uri_by_ledger_system[ident.system] == fhir_ident["system"]


def _event_resources(bundle: dict) -> list[dict]:
    return [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] != "Patient"]


def test_every_event_resource_uses_exactly_one_effective_choice_variant():
    bundle = build_fhir_bundle(_LEDGER)
    for resource in _event_resources(bundle):
        variants_present = [
            key for key in ("effectiveDateTime", "effectivePeriod", "performedDateTime")
            if key in resource
        ]
        assert len(variants_present) == 1, (
            f"{resource['resourceType']} {resource.get('id')} must carry exactly one "
            f"effective[x]/performed[x] variant, found {variants_present}"
        )


def test_dexa_scan_deliberately_uses_effectivePeriod_not_effectiveDateTime():
    # SPEC.md 473: a reader that only checks effectiveDateTime silently drops
    # every observation recorded as a period. Seed at least one so the
    # downstream COALESCE requirement has something real to fail against.
    bundle = build_fhir_bundle(_LEDGER)
    dexa_event = next(e for e in _LEDGER.events if e.kind == "dexa_scan")
    dexa_resource = next(
        r for r in _event_resources(bundle)
        if r["resourceType"] == "Observation" and r.get("id") == dexa_event.event_id
    )
    assert "effectivePeriod" in dexa_resource
    assert "effectiveDateTime" not in dexa_resource
    assert dexa_resource["effectivePeriod"]["start"] == dexa_event.event_time.isoformat()


def test_her2_observations_carry_both_r2_clocks_via_effective_and_issued():
    bundle = build_fhir_bundle(_LEDGER)
    her2_events = {e.event_id: e for e in _LEDGER.events if e.kind == "her2_result"}
    her2_resources = [r for r in _event_resources(bundle) if r.get("id") in her2_events]
    assert len(her2_resources) == 2

    for resource in her2_resources:
        event = her2_events[resource["id"]]
        assert resource["effectiveDateTime"] == event.event_time.isoformat()
        assert resource["issued"] == event.source_recorded_at.isoformat()


def test_her2_discordance_survives_into_fhir_as_two_distinct_observations():
    bundle = build_fhir_bundle(_LEDGER)
    her2_resources = [
        r for r in _event_resources(bundle)
        if r["resourceType"] == "Observation" and r.get("code", {}).get("text") == "HER2"
    ]
    assert len(her2_resources) == 2
    specimen_refs = {r["specimen"]["display"] for r in her2_resources}
    assert len(specimen_refs) == 2, "the two specimens must remain distinguishable in the bundle"


def test_bundle_is_json_serializable_with_no_raw_datetimes():
    bundle = build_fhir_bundle(_LEDGER)
    # json.dumps raises TypeError on a raw datetime — this is the actual
    # contract check, not just "does it look like a dict of strings".
    serialized = json.dumps(bundle)
    assert json.loads(serialized) == bundle


def test_deterministic_same_ledger_same_bundle():
    a = build_fhir_bundle(_LEDGER)
    b = build_fhir_bundle(_LEDGER)
    assert a == b
