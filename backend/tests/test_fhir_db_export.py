"""Synthetic export checks; no Snowflake writes or FHIR conformance claim."""
import pytest

from backend.scripts import generate_fhir_bundles as exporter
from data.generator.fhir_from_db import build_fhir_bundle_from_db


@pytest.mark.parametrize('fetch', ['fetch_patients', 'fetch_identifiers', 'fetch_events'])
def test_patient_ids_are_sql_literals(monkeypatch, fetch):
    statements = []
    monkeypatch.setattr(exporter, 'query_rows', lambda connection, sql: statements.append(sql) or [])
    getattr(exporter, fetch)('synthetic', "PAT' OR 1=1 --")
    assert "'PAT'' OR 1=1 --'" in statements[0]


def test_load_escapes_source_id_and_payload(monkeypatch):
    statements = []
    monkeypatch.setattr(exporter, 'run_snow', lambda connection, sql: statements.append(sql) or '')
    exporter.load_bundle_into_db('synthetic', "PAT'1", {'text': "patient's record"})
    assert "'SAARTHI-FHIR-EXPORT/PAT''1'" in statements[0]
    assert "patient''s record" in statements[0]


def test_export_preserves_zero_and_distinct_clocks_and_orders_events():
    event = dict(EVENT_ID='E2', EVENT_TYPE='lab', CODE='123', VALUE_NUM=0,
                 EVENT_TIME='2026-09-01 10:00:00', SOURCE_RECORDED_AT='2026-09-02 10:00:00')
    earlier = dict(event, EVENT_ID='E1')
    bundle = build_fhir_bundle_from_db('PAT-SYNTHETIC', [{'SYSTEM': 'MRN', 'VALUE': 'SYNTHETIC-1'}], [event, earlier])
    resources = [entry['resource'] for entry in bundle['entry']]
    assert [resource['id'] for resource in resources] == ['PAT-SYNTHETIC', 'E1', 'E2']
    assert resources[1]['valueQuantity']['value'] == 0
    assert resources[1]['effectiveDateTime'] != resources[1]['issued']
    assert bundle == build_fhir_bundle_from_db('PAT-SYNTHETIC', [{'SYSTEM': 'MRN', 'VALUE': 'SYNTHETIC-1'}], [earlier, event])


def test_unknown_event_type_is_rejected():
    with pytest.raises(ValueError, match='no FHIR mapping'):
        build_fhir_bundle_from_db('PAT-SYNTHETIC', [], [{'EVENT_ID': 'E1', 'EVENT_TYPE': 'unknown'}])


def test_sql_literal_preserves_backslashes_and_quotes():
    assert exporter.sql_literal("PAT\\'1") == "'PAT\\\\''1'"
