"""Tests for data/generator/ledger.py — the seeded deep-case fact ledger.

Contract 5 (ARCHITECTURE-HANDOFF.md 146, SPEC.md 9): a seeded, deterministic
fact ledger generated first, with every later projection (CSVs, FHIR bundle,
PDFs) derived from it — so the ledger has to be the actual ground truth, not
a fixture that happens to look right once.

This covers only the Day-1/2 deep case (one patient), not the 100-patient
Day-6 cohort — that is a separate, later feature per WORK-PLAN.md.
"""

from __future__ import annotations

from data.generator.ledger import generate_deep_case


def test_same_seed_is_byte_identical():
    a = generate_deep_case(seed=20260918)
    b = generate_deep_case(seed=20260918)
    assert a == b


def test_different_seed_changes_the_ledger():
    a = generate_deep_case(seed=20260918)
    b = generate_deep_case(seed=1)
    assert a != b


def test_four_facilities():
    ledger = generate_deep_case(seed=20260918)
    facility_ids = {ident.facility_id for ident in ledger.identifiers}
    facility_ids |= {event.facility_id for event in ledger.events}
    assert len(facility_ids) == 4


def test_seven_identifiers_zero_abha():
    ledger = generate_deep_case(seed=20260918)
    assert len(ledger.identifiers) == 7
    assert sum(1 for ident in ledger.identifiers if ident.system == "ABHA") == 0


def test_every_identifier_references_a_known_facility():
    ledger = generate_deep_case(seed=20260918)
    known = {f.facility_id for f in ledger.facilities}
    assert all(ident.facility_id in known for ident in ledger.identifiers)


def test_every_event_references_a_known_facility():
    ledger = generate_deep_case(seed=20260918)
    known = {f.facility_id for f in ledger.facilities}
    assert all(event.facility_id in known for event in ledger.events)


def test_her2_discordant_across_specimens():
    ledger = generate_deep_case(seed=20260918)
    her2 = [e for e in ledger.events if e.kind == "her2_result"]
    assert len(her2) == 2

    specimen_ids = {e.specimen_id for e in her2}
    assert len(specimen_ids) == 2, "the two HER2 results must come from different specimens"

    by_specimen = {e.specimen_source: e for e in her2}
    assert by_specimen["outside_biopsy"].grade == "II"
    assert by_specimen["outside_biopsy"].ihc_score == "1+"
    assert by_specimen["surgical_specimen"].grade == "III"
    assert by_specimen["surgical_specimen"].ihc_score == "2+"


def test_appendectomy_falls_strictly_between_two_chemo_cycles():
    ledger = generate_deep_case(seed=20260918)
    chemo_times = sorted(e.event_time for e in ledger.events if e.kind == "chemo_cycle")
    appendectomy = [e for e in ledger.events if e.kind == "appendectomy"]
    assert len(appendectomy) == 1

    before = [t for t in chemo_times if t < appendectomy[0].event_time]
    after = [t for t in chemo_times if t > appendectomy[0].event_time]
    assert before and after, "appendectomy must be mid-treatment, not before or after the whole course"


def test_dexa_and_zoledronic_acid_present():
    ledger = generate_deep_case(seed=20260918)
    kinds = {e.kind for e in ledger.events}
    assert "dexa_scan" in kinds
    assert "zoledronic_acid_infusion" in kinds

    dexa = next(e for e in ledger.events if e.kind == "dexa_scan")
    assert dexa.t_score is not None and dexa.t_score <= -1.0, "osteopenia range"


def test_four_treatment_plan_versions_in_order():
    ledger = generate_deep_case(seed=20260918)
    versions = sorted(ledger.treatment_plan_versions, key=lambda v: v.version)
    assert [v.version for v in versions] == [1, 2, 3, 4]

    effective_dates = [v.effective_from for v in versions]
    assert effective_dates == sorted(effective_dates), "versions must be strictly time-ordered"
    assert len(set(effective_dates)) == 4, "no two versions may share an effective date"


def test_every_event_carries_the_two_source_clocks():
    ledger = generate_deep_case(seed=20260918)
    for event in ledger.events:
        assert event.event_time is not None
        assert event.source_recorded_at is not None
        # R2: the record clock is never earlier than the clinical clock —
        # a system cannot record an event before it happened.
        assert event.source_recorded_at >= event.event_time


def test_patient_id_is_stable_across_calls():
    a = generate_deep_case(seed=20260918)
    b = generate_deep_case(seed=20260918)
    assert a.patient_id == b.patient_id
