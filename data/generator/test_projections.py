"""Tests for data/generator/projections.py — per-source-system CSVs.

Contract 5 (SPEC.md 9, 444): "CSV per source system" is the structured
ingestion path, and R4's whole design centre is that a source system's own
export carries only *its own* local identifier — never a shared key, never a
name join. A projection that leaked the internal ledger.patient_id into a
facility's CSV would silently defeat the thing this test suite exists to
prove: identity resolution has to happen downstream, in ID_MAP, not by every
source system already agreeing on one ID.
"""

from __future__ import annotations

import csv

from data.generator.ledger import generate_deep_case
from data.generator.projections import ROW_FIELDS, project_to_source_rows, write_csvs

_LEDGER = generate_deep_case(seed=20260918)


def test_one_row_group_per_facility_with_events():
    groups = project_to_source_rows(_LEDGER)
    facilities_with_events = {e.facility_id for e in _LEDGER.events}
    assert set(groups.keys()) == facilities_with_events


def test_every_event_appears_exactly_once():
    groups = project_to_source_rows(_LEDGER)
    total_rows = sum(len(rows) for rows in groups.values())
    assert total_rows == len(_LEDGER.events)

    all_event_ids = [row["event_id"] for rows in groups.values() for row in rows]
    assert len(all_event_ids) == len(set(all_event_ids)), "no event duplicated across groups"
    assert set(all_event_ids) == {e.event_id for e in _LEDGER.events}


def test_row_uses_the_facility_own_mrn_never_the_internal_patient_id():
    groups = project_to_source_rows(_LEDGER)
    mrn_by_facility = {
        ident.facility_id: ident.value
        for ident in _LEDGER.identifiers
        if ident.system == "MRN"
    }
    for facility_id, rows in groups.items():
        expected_mrn = mrn_by_facility[facility_id]
        for row in rows:
            assert row["local_patient_id"] == expected_mrn
            assert row["local_patient_id"] != _LEDGER.patient_id


def test_rows_within_a_facility_are_time_ordered():
    groups = project_to_source_rows(_LEDGER)
    for rows in groups.values():
        times = [row["event_time"] for row in rows]
        assert times == sorted(times)


def test_every_row_has_the_full_column_set():
    groups = project_to_source_rows(_LEDGER)
    for rows in groups.values():
        for row in rows:
            assert set(row.keys()) == set(ROW_FIELDS)


def test_kind_specific_fields_blank_when_not_applicable():
    groups = project_to_source_rows(_LEDGER)
    chemo_rows = [row for rows in groups.values() for row in rows if row["kind"] == "chemo_cycle"]
    assert chemo_rows
    for row in chemo_rows:
        assert row["specimen_id"] == ""
        assert row["grade"] == ""
        assert row["t_score"] == ""


def test_write_csvs_creates_one_file_per_facility(tmp_path):
    written = write_csvs(_LEDGER, tmp_path)
    groups = project_to_source_rows(_LEDGER)
    assert set(written) == set(groups.keys())

    for facility_id, path in written.items():
        assert path.exists()
        with path.open(newline="") as f:
            reader = csv.DictReader(f)
            assert reader.fieldnames == ROW_FIELDS
            rows = list(reader)
        assert len(rows) == len(groups[facility_id])


def test_write_csvs_is_deterministic(tmp_path):
    out_a = tmp_path / "a"
    out_b = tmp_path / "b"
    written_a = write_csvs(_LEDGER, out_a)
    written_b = write_csvs(_LEDGER, out_b)

    for facility_id in written_a:
        assert written_a[facility_id].read_text() == written_b[facility_id].read_text()
